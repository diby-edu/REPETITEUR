-- ============================================================
-- FIX cosmétique : format des montants dans les notifications
-- ------------------------------------------------------------
-- `to_char(n, 'FM999G999')` produit une VIRGULE comme séparateur
-- de milliers sous la locale par défaut (C/en) → "70,000".
-- Le reste de l'app utilise l'espace français → "70 000".
-- On remplace par `replace(to_char(n, 'FM999,999,999'), ',', ' ')`
-- qui garantit "70 000" quelle que soit la locale du serveur.
--
-- 3 fonctions concernées (recréées à l'identique, seul le format change) :
--   • check_expiring_engagements()  (J-3 règlement)
--   • handle_engagement_created()   (nouveau contrat proposé)
--   • handle_payment_declared()     (paiement déclaré)
--
-- Idempotent : réexécutable sans risque (CREATE OR REPLACE).
-- ============================================================

-- 1) J-3 : règlement à prévoir --------------------------------
create or replace function public.check_expiring_engagements() returns void as $$
declare
  eng public.engagements%rowtype;
  t   public.profiles%rowtype;
begin
  for eng in
    select * from public.engagements
    where status = 'active'
    and end_date = current_date + 3
    and not exists (
      select 1 from public.notifications n
      where n.user_id = eng.parent_id
      and n.type = 'engagement_expiring'
      and n.created_at::date = current_date
    )
  loop
    select * into t from public.profiles where id = eng.tutor_id;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      eng.parent_id,
      'engagement_expiring',
      'Règlement à prévoir dans 3 jours',
      'Votre contrat avec ' || t.first_name || ' ' || t.last_name ||
      ' (' || eng.subject || ') se termine le ' ||
      to_char(eng.end_date, 'DD/MM/YYYY') ||
      '. Préparez le règlement de ' ||
      replace(to_char(eng.monthly_rate, 'FM999,999,999'), ',', ' ') || ' FCFA.',
      '/tableau-de-bord/parent'
    );
  end loop;
end;
$$ language plpgsql security definer;

-- 2) Nouveau contrat proposé → notifier le répétiteur --------
create or replace function public.handle_engagement_created()
returns trigger as $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = new.parent_id;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.tutor_id,
    'engagement_proposed',
    'Nouveau contrat proposé',
    p.first_name || ' ' || p.last_name ||
    ' vous propose un contrat de répétition en ' || new.subject ||
    ' (' || replace(to_char(new.monthly_rate, 'FM999,999,999'), ',', ' ') || ' FCFA/mois).',
    '/tableau-de-bord/repetiteur'
  );
  return new;
end;
$$ language plpgsql security definer;

-- 3) Paiement déclaré → notifier le répétiteur ---------------
create or replace function public.handle_payment_declared()
returns trigger as $$
declare
  eng public.engagements%rowtype;
  p   public.profiles%rowtype;
  method_label text;
begin
  if new.status = 'parent_declared' and old.status = 'pending' then
    select * into eng from public.engagements where id = new.engagement_id;
    select * into p   from public.profiles    where id = eng.parent_id;

    method_label := case new.payment_method
      when 'cash'         then 'Cash'
      when 'orange_money' then 'Orange Money'
      when 'wave'         then 'Wave'
      when 'mtn_money'    then 'MTN Money'
      else 'hors ligne'
    end;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      eng.tutor_id,
      'payment_declared',
      'Paiement déclaré — action requise',
      p.first_name || ' ' || p.last_name ||
      ' a déclaré avoir payé ' ||
      replace(to_char(new.amount, 'FM999,999,999'), ',', ' ') || ' FCFA (' || method_label || '). ' ||
      case when new.parent_wants_continue
        then 'Souhaite continuer le mois prochain.'
        else 'Ne souhaite pas renouveler le contrat.'
      end,
      '/tableau-de-bord/repetiteur'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;
