-- ============================================================
-- Lot E — Rétention / expiration d'abonnement répétiteur
--   1) Message aux parents à l'expiration : plus drastique mais
--      diplomate (déconseille de payer hors plateforme, décharge
--      de responsabilité).
--   2) Alertes d'expiration à J-3 et J-1 au répétiteur (ce qu'il
--      perd s'il ne renouvelle pas).
-- Idempotent (CREATE OR REPLACE). À lancer dans Supabase > SQL Editor.
-- ============================================================

-- 1) Auto-résiliation : message parent enrichi -----------------
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
    select t.id, p.first_name, p.last_name
    from public.tutors t
    join public.profiles p on p.id = t.id
    where t.subscription_end is not null
      and t.subscription_end < current_date
      and (t.is_active = true or t.subscription_status = 'active')
      and t.subscription_plan is distinct from 'gratuit'
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

    -- Message aux parents concernés : drastique mais diplomate.
    insert into public.notifications (user_id, type, title, message, link)
    select distinct e.parent_id, 'engagement', 'Contrat terminé — répétiteur non renouvelé',
      'Le contrat avec ' || r.first_name || ' ' || r.last_name ||
      ' a pris fin : ce répétiteur n''a pas renouvelé son abonnement et n''est plus référencé sur MonRépétiteur. ' ||
      'Par prudence, nous vous déconseillons de poursuivre les paiements ou les séances hors plateforme — ' ||
      'nous ne pouvons plus garantir son sérieux ni intervenir en cas de litige. ' ||
      'Retrouvez d''autres répétiteurs vérifiés dans la recherche.',
      '/recherche'
    from public.engagements e
    where e.tutor_id = r.id and e.ended_by = 'system'
      and e.ended_at >= now() - interval '2 minutes';
  end loop;
end;
$$;

grant execute on function public.expire_lapsed_subscriptions() to authenticated;

-- 2) Alertes AVANT expiration (J-3 et J-1) au répétiteur -------
create or replace function public.notify_expiring_subscriptions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record; d int;
begin
  for r in
    select id, subscription_end
    from public.tutors
    where subscription_end is not null
      and subscription_status = 'active'
      and subscription_plan is distinct from 'gratuit'
      and (subscription_end - current_date) in (3, 1)
  loop
    d := r.subscription_end - current_date;
    -- Une seule alerte par jour
    if not exists (
      select 1 from public.notifications n
      where n.user_id = r.id and n.type = 'subscription_expiring'
        and n.created_at::date = current_date
    ) then
      insert into public.notifications (user_id, type, title, message, link)
      values (
        r.id, 'subscription_expiring',
        'Abonnement — ' || d || (case when d > 1 then ' jours restants' else ' jour restant' end),
        'Votre abonnement expire dans ' || d || (case when d > 1 then ' jours' else ' jour' end) ||
        '. Sans renouvellement : votre profil sera masqué des recherches, vos avis et votre note cachés, et vos contrats actifs résiliés. Renouvelez pour rester visible.',
        '/abonnement');
    end if;
  end loop;
end;
$$;

grant execute on function public.notify_expiring_subscriptions() to authenticated;
