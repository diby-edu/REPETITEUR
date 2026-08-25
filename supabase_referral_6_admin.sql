-- ============================================================
-- PARRAINAGE — Étape 6 : admin (vue d'ensemble + crédit manuel)
--   • admin_referral_overview() : fondateurs, totaux, liste des parrains
--   • admin_grant_reward_days() : créditer des jours à la main
--   (Les réglages : l'admin édite referral_config directement — RLS OK.)
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- ============================================================

create or replace function public.admin_referral_overview()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare cfg public.referral_config%rowtype; result jsonb;
begin
  if not public.is_admin() then raise exception 'Réservé à l''administration.'; end if;
  select * into cfg from public.referral_config where id = 1;
  select jsonb_build_object(
    'founders_used',  (select count(*) from public.tutors where welcome_claimed),
    'founders_max',   cfg.welcome_max_tutors,
    'total_referred', (select count(*) from public.tutors where referred_by is not null),
    'total_qualified',(select count(*) from public.tutors where referral_qualified),
    'referrers', coalesce((
      select jsonb_agg(x order by x->>'total' desc) from (
        select jsonb_build_object(
          'id', r.id,
          'name', p.first_name || ' ' || p.last_name,
          'code', r.referral_code,
          'total', (select count(*) from public.tutors f where f.referred_by = r.id),
          'qualified', (select count(*) from public.tutors f where f.referred_by = r.id and f.referral_qualified),
          'pending', (select count(*) from public.tutors f where f.referred_by = r.id and not f.referral_qualified),
          'rewards_granted', r.referral_rewards_granted,
          'banked_days', r.reward_days_banked
        ) as x
        from public.tutors r join public.profiles p on p.id = r.id
        where exists (select 1 from public.tutors f where f.referred_by = r.id)
      ) s
    ), '[]'::jsonb)
  ) into result;
  return result;
end; $$;
grant execute on function public.admin_referral_overview() to authenticated;

-- Crédit manuel de jours d'abonnement (litige / geste commercial)
create or replace function public.admin_grant_reward_days(p_tutor uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Réservé à l''administration.'; end if;
  if p_days is null or p_days = 0 then return; end if;
  perform set_config('app.system_task','1',true);
  update public.tutors set
    subscription_end = greatest(current_date, coalesce(subscription_end, current_date)) + p_days
  where id = p_tutor;
end; $$;
grant execute on function public.admin_grant_reward_days(uuid, int) to authenticated;
