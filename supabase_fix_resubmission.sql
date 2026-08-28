-- ============================================================
-- MonRépétiteur — Fix : re-soumission de documents après rejet
-- ------------------------------------------------------------
-- Problème : quand un répétiteur corrige un document rejeté, la
-- colonne `verification_status` reste figée sur 'rejected' (le
-- trigger de sécurité interdit au client de la changer, et rien
-- ne la recalcule côté serveur). Le dossier ne revient donc
-- jamais dans la file « Actions requises » de l'admin.
--
-- Ce fix (choix A — intégrité KYC) :
--   1) Toute MODIFICATION de `documents` par le répétiteur renvoie
--      son dossier en 'pending' (re-vérification) + le masque.
--   2) Les DÉCISIONS de review (approved/rejected) restent 100 %
--      admin : on retire tout champ `review` que le client aurait
--      tenté d'injecter dans `documents` (ferme une faille d'auto-
--      validation latente).
--   3) Notification aux admins : « X a corrigé ses documents ».
--   4) Backfill : débloque les dossiers déjà corrigés mais coincés
--      en 'rejected' (ex. Seydou).
--
-- À coller dans Supabase > SQL Editor > New query > Run.
-- Rollback : supabase_fix_resubmission_rollback.sql
-- ============================================================


-- ============================================================
-- 1) protect_tutor_privileged_fields — version « choix A »
--    (remplace celle de supabase_audit_fixes.sql)
-- ============================================================
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
declare
  cleaned jsonb;
begin
  -- Recalcul de note serveur : autorisé
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Auto-service : uniquement le repli vers le plan gratuit.
  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;

  -- ── Documents (KYC) ────────────────────────────────────────
  if new.documents is distinct from old.documents then
    -- (a) Retirer toute décision de review injectée par le client :
    --     pièce d'identité, selfie, et chaque diplôme.
    cleaned := coalesce(new.documents, '{}'::jsonb) - 'idReview' - 'selfieReview';
    if jsonb_typeof(cleaned -> 'diplomes') = 'array' then
      cleaned := jsonb_set(
        cleaned,
        '{diplomes}',
        coalesce(
          (select jsonb_agg(elem - 'review')
             from jsonb_array_elements(cleaned -> 'diplomes') as elem),
          '[]'::jsonb
        )
      );
    end if;
    new.documents := cleaned;

    -- (b) Toute modification de dossier -> re-vérification.
    --     Le tuteur ne peut que se remettre en attente, jamais se
    --     valider lui-même.
    new.verification_status := 'pending';
    new.rejection_reason    := null;
    new.is_active           := false;
  else
    -- Documents inchangés : on gèle le statut comme avant.
    new.verification_status := old.verification_status;
    new.rejection_reason    := old.rejection_reason;
    -- Auto-service : se désactiver soi-même est permis, s'activer non.
    if new.is_active then
      new.is_active := old.is_active;
    end if;
  end if;

  -- Champs toujours gelés côté client
  new.rating           := old.rating;
  new.review_count     := old.review_count;
  new.session_count    := old.session_count;
  new.profile_views    := old.profile_views;
  new.monthly_requests := old.monthly_requests;
  new.suspended        := old.suspended;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- (le trigger protect_tutor_privileged_fields existe déjà ; on ne
--  recrée que la fonction. Rappel de la définition, idempotent :)
drop trigger if exists protect_tutor_privileged_fields on public.tutors;
create trigger protect_tutor_privileged_fields
  before update on public.tutors
  for each row execute procedure public.protect_tutor_privileged_fields();


-- ============================================================
-- 2) Notification admin : « X a corrigé ses documents »
--    Ne se déclenche que sur une VRAIE re-soumission (documents
--    changés) qui ramène le dossier en 'pending', et jamais pour
--    la première soumission (pending -> pending) ni pour une
--    action de l'admin lui-même.
-- ============================================================
create or replace function public.notify_admin_docs_resubmitted()
returns trigger as $$
declare
  tutor_name text;
  label      text;
begin
  if new.verification_status <> 'pending' then return new; end if;
  if old.verification_status is not distinct from 'pending' then return new; end if; -- 1re soumission : ignore
  if new.documents is not distinct from old.documents then return new; end if;
  if public.is_admin() then return new; end if;  -- pas quand c'est l'admin qui agit

  select first_name || ' ' || last_name into tutor_name
  from public.profiles where id = new.id;

  label := case
    when old.verification_status = 'rejected'
      then ' a corrigé ses documents (dossier précédemment rejeté).'
    else ' a modifié ses documents — dossier à re-vérifier.'
  end;

  insert into public.notifications (user_id, type, title, message, link)
  select p.id,
         'doc_resubmitted',
         'Documents à re-vérifier',
         coalesce(tutor_name, 'Un répétiteur') || label,
         '/admin?tab=Vérifications'
  from public.profiles p
  where p.role = 'admin';

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_tutor_docs_resubmitted on public.tutors;
create trigger on_tutor_docs_resubmitted
  after update of documents on public.tutors
  for each row execute procedure public.notify_admin_docs_resubmitted();


-- ============================================================
-- 3) Backfill : débloquer les dossiers déjà corrigés mais coincés
--    en 'rejected' (documents ne contenant plus aucune review
--    'rejected'). On désactive temporairement le trigger de garde
--    pour pouvoir écrire verification_status.
-- ============================================================
alter table public.tutors disable trigger protect_tutor_privileged_fields;

update public.tutors t
set verification_status = 'pending',
    rejection_reason    = null,
    is_active           = false
where t.verification_status = 'rejected'
  and coalesce(t.documents -> 'idReview'     ->> 'status', '') <> 'rejected'
  and coalesce(t.documents -> 'selfieReview' ->> 'status', '') <> 'rejected'
  and not exists (
    select 1
    from jsonb_array_elements(coalesce(t.documents -> 'diplomes', '[]'::jsonb)) as d
    where coalesce(d -> 'review' ->> 'status', '') = 'rejected'
  );

alter table public.tutors enable trigger protect_tutor_privileged_fields;

-- Fin. Vérif rapide :
--   select id, verification_status, is_active from public.tutors
--   where verification_status = 'pending';
