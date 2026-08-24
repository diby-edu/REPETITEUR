-- ============================================================
-- DURCISSEMENT : verrouiller status / end_date des engagements
-- ------------------------------------------------------------
-- Problème : la policy UPDATE autorise parent OU tuteur, et le
-- trigger protect_engagement_fields ne contrôlait ni `status`
-- ni `end_date`. Via un appel REST direct on pouvait :
--   • forcer un contrat pending -> active (sans accord du tuteur) ;
--   • repousser end_date (décaler l'échéance de règlement/expiration) ;
--   • écrire un status arbitraire.
--
-- Solution (machine à états dans le trigger, SANS changement client) :
--   • end_date : non modifiable côté client (le renouvellement +30
--     passe par une tâche système marquée du drapeau app.system_task) ;
--   • status : seules les transitions légitimes, par l'acteur autorisé :
--        - pending -> active           : le RÉPÉTITEUR (acceptation)
--        - pending|active -> ended      : une PARTIE (refus/annulation/résiliation)
--     toute autre transition => RAISE EXCEPTION (annule la transaction,
--     donc pas de séances/notifs fantômes générées par le trigger
--     BEFORE `on_engagement_updated` qui se déclenche avant celui-ci).
--
-- Bypass : app.system_task / app.rating_recompute / service_role / admin.
-- Les fonctions système qui modifient légitimement status/end_date
-- posent le drapeau app.system_task (handle_payment_confirmed,
-- expire_ended_engagements ; expire_lapsed_subscriptions l'a déjà).
--
-- Idempotent (CREATE OR REPLACE). Aucun changement côté application.
-- À lancer dans Supabase > SQL Editor > Run.
-- ============================================================

-- 1) Le garde-fou principal ----------------------------------
create or replace function public.protect_engagement_fields()
returns trigger as $$
begin
  -- Bypass : tâches système / recalcul / admin / service_role
  if coalesce(current_setting('app.system_task', true), '') = '1' then return new; end if;
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then return new; end if;
  if auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then return new; end if;

  -- Champs immuables côté client
  new.parent_id    := old.parent_id;
  new.tutor_id     := old.tutor_id;
  new.subject      := old.subject;
  new.monthly_rate := old.monthly_rate;
  new.start_date   := old.start_date;
  new.created_at   := old.created_at;

  -- « Séances validées » : réservé au PARENT du contrat
  if auth.uid() is distinct from old.parent_id then
    new.sessions_done := old.sessions_done;
  end if;

  -- end_date : jamais modifiable directement (renouvellement = système)
  if new.end_date is distinct from old.end_date then
    raise exception 'end_date non modifiable directement (engagement %)', old.id
      using errcode = 'check_violation';
  end if;

  -- status : uniquement les transitions légitimes, par l'acteur autorisé
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'active'
       and auth.uid() = old.tutor_id then
      null;  -- acceptation par le répétiteur
    elsif new.status = 'ended' and old.status in ('pending', 'active')
          and auth.uid() in (old.parent_id, old.tutor_id) then
      null;  -- refus / annulation / résiliation par une partie
    else
      raise exception 'transition de statut interdite : % -> % (engagement %)',
        old.status, new.status, old.id using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 2) Renouvellement / fin sur paiement confirmé (pose le drapeau) ----
create or replace function public.handle_payment_confirmed()
returns trigger as $$
declare
  eng public.engagements%rowtype;
  t   public.profiles%rowtype;
begin
  if new.status = 'confirmed' and old.status = 'parent_declared' then
    -- Autorise cette fonction système à modifier end_date/status de l'engagement
    perform set_config('app.system_task', '1', true);

    select * into eng from public.engagements where id = new.engagement_id;
    select * into t   from public.profiles    where id = eng.tutor_id;

    if new.parent_wants_continue and new.tutor_wants_continue then
      -- Les deux veulent continuer → prolonger de 30 jours
      update public.engagements
      set end_date = end_date + 30, updated_at = now()
      where id = new.engagement_id;

      insert into public.notifications (user_id, type, title, message, link)
      values (
        eng.parent_id,
        'payment_confirmed',
        'Paiement confirmé — Contrat renouvelé',
        t.first_name || ' ' || t.last_name ||
        ' a confirmé le paiement. Votre contrat est renouvelé pour un mois supplémentaire.',
        '/tableau-de-bord/parent'
      );

    else
      -- L'un ou l'autre ne veut pas continuer → terminer le contrat
      update public.engagements
      set status = 'ended', updated_at = now()
      where id = new.engagement_id;

      insert into public.notifications (user_id, type, title, message, link)
      values (
        eng.parent_id,
        'payment_confirmed',
        'Paiement confirmé — Contrat terminé',
        t.first_name || ' ' || t.last_name ||
        ' a confirmé le paiement. Le contrat prend fin.',
        '/tableau-de-bord/parent'
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- 3) Expiration des engagements échus (pose le drapeau) -------------
create or replace function public.expire_ended_engagements() returns void as $$
begin
  perform set_config('app.system_task', '1', true);

  update public.engagements
  set status = 'ended', updated_at = now()
  where status = 'active'
  and end_date < current_date
  -- Pas de paiement confirmé avec volonté de continuer des deux côtés
  and not exists (
    select 1 from public.payments p
    where p.engagement_id = engagements.id
    and p.period_end = engagements.end_date
    and p.status = 'confirmed'
    and p.parent_wants_continue = true
    and p.tutor_wants_continue  = true
  );
end;
$$ language plpgsql security definer;
