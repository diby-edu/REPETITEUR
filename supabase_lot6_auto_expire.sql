-- ============================================================
-- REFONTE Lot 6 : auto-résiliation quand l'abonnement répétiteur est impayé
--   - subscription_end dépassé → profil masqué (is_active=false)
--     + subscription_status='expired' + contrats actifs résiliés (ended)
--     + notifications au répétiteur ET aux parents concernés.
--   - Exécuté à chaque login via runMaintenanceTasks (RPC), et/ou par pg_cron.
-- À lancer dans Supabase > SQL Editor > Run. Idempotent.
-- ============================================================

-- 1) Autoriser les tâches système à écrire les colonnes protégées de tutors
--    (drapeau de transaction app.system_task, comme app.rating_recompute).
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
begin
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then return new; end if;
  if coalesce(current_setting('app.system_task', true), '') = '1' then return new; end if;
  if auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then return new; end if;

  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;

  if new.is_active then
    new.is_active := old.is_active;
  end if;

  new.verification_status := old.verification_status;
  new.rejection_reason    := old.rejection_reason;
  new.rating              := old.rating;
  new.review_count        := old.review_count;
  new.session_count       := old.session_count;
  new.profile_views       := old.profile_views;
  new.monthly_requests    := old.monthly_requests;
  new.suspended           := old.suspended;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_tutor_privileged_fields on public.tutors;
create trigger protect_tutor_privileged_fields
  before update on public.tutors
  for each row execute procedure public.protect_tutor_privileged_fields();

-- 2) La fonction d'expiration
create or replace function public.expire_lapsed_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  perform set_config('app.system_task', '1', true);

  for r in
    select id from public.tutors
    where subscription_end is not null
      and subscription_end < current_date
      and (is_active = true or subscription_status = 'active')
      and subscription_plan is distinct from 'gratuit'
  loop
    update public.tutors
      set is_active = false, subscription_status = 'expired'
      where id = r.id;

    update public.engagements
      set status = 'ended', ended_by = 'system', ended_at = now()
      where tutor_id = r.id and status = 'active';

    perform public.create_notification(
      r.id, 'subscription', 'Abonnement expiré',
      'Votre abonnement a expiré : votre profil est masqué et vos contrats actifs ont été résiliés. Renouvelez pour réactiver.',
      '/abonnement');

    insert into public.notifications (user_id, type, title, message, link)
    select distinct e.parent_id, 'engagement', 'Contrat résilié',
      'Un de vos contrats a pris fin car le répétiteur n''a pas renouvelé son abonnement.',
      '/reservations'
    from public.engagements e
    where e.tutor_id = r.id and e.ended_by = 'system'
      and e.ended_at >= now() - interval '2 minutes';
  end loop;
end;
$$;

grant execute on function public.expire_lapsed_subscriptions() to authenticated;

-- 3) (Optionnel) vrai cron quotidien si l'extension pg_cron est activée :
--    Décommenter après avoir activé pg_cron (Database > Extensions).
-- select cron.schedule('expire-lapsed-subs', '0 2 * * *',
--   $$ select public.expire_lapsed_subscriptions() $$);
