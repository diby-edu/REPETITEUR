-- ============================================================
-- MonRépétiteur — ROLLBACK des correctifs d'audit
-- Annule supabase_audit_fixes.sql et restaure l'état PRÉCÉDENT.
--
-- ⚠️ ATTENTION : ce rollback RÉOUVRE plusieurs failles de sécurité :
--    - F3 : email/téléphone de tous les profils redeviennent publics
--    - F4 : escalade de rôle 'admin' possible à l'inscription
--    - F5 : paiements/engagements de nouveau modifiables librement
--    - F11 : avis publiables sans relation réelle
--    - F13 : messages injectables hors conversation
--
-- 👉 Si SEUL le CODE pose problème (recherche/dashboards), NE roule PAS
--    la base : reviens simplement au code précédent (git checkout main).
--    Ne roule la base QUE si la migration DB elle-même casse quelque chose.
--
-- Le rollback NE réactive PAS le bucket public ni ne redésactive le RLS
-- storage (on ne veut pas rouvrir la fuite KYC F1). Voir section STORAGE.
--
-- Idempotent. Coller dans SQL Editor > New query > Run.
-- ============================================================

-- ── F3 : restaurer l'accès public aux tables + retirer les vues ──
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "Profils visibles par tous" on public.profiles;
create policy "Profils visibles par tous" on public.profiles for select using (true);

drop policy if exists "tutors_select_self_or_admin" on public.tutors;
drop policy if exists "Tuteurs visibles par tous" on public.tutors;
create policy "Tuteurs visibles par tous" on public.tutors for select using (true);

drop view if exists public.public_tutors;
drop view if exists public.public_profiles;

-- ── F13 : restaurer l'insertion de messages (sender_id seul) ──
drop policy if exists "Envoyer un message" on public.messages;
create policy "Envoyer un message" on public.messages for insert
  with check (auth.uid() = sender_id);

-- ── F11 : restaurer l'insertion d'avis (parent_id seul) ──
drop policy if exists "Parent publie un avis" on public.reviews;
create policy "Parent publie un avis" on public.reviews for insert
  with check (auth.uid() = parent_id);

-- ── F17 : restaurer l'insertion d'engagement (parent_id seul) ──
drop policy if exists "Parent crée un engagement" on public.engagements;
create policy "Parent crée un engagement" on public.engagements for insert
  with check (auth.uid() = parent_id);

-- ── F5 : retirer les protections engagements / paiements ──
drop trigger if exists protect_engagement_fields on public.engagements;
drop function if exists public.protect_engagement_fields();
drop trigger if exists protect_payment_fields on public.payments;
drop function if exists public.protect_payment_fields();

-- ── F12 : retirer le recalcul serveur de la note ──
drop trigger if exists recompute_tutor_rating on public.reviews;
drop function if exists public.recompute_tutor_rating();

-- ── F5/F12 : restaurer protect_tutor_privileged_fields d'origine ──
--    (sans dérogation rating, avec vérif admin inline)
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

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

-- ── F4 : restaurer handle_new_user d'origine (fait confiance au rôle) ──
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, role, first_name, last_name, email,
    phone, city, quartier, avatar_color,
    subjects_needed, child_level, open_to_contact
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'quartier',
    coalesce(new.raw_user_meta_data->>'avatar_color', '#E87722'),
    case when new.raw_user_meta_data->'subjects_needed' is not null
         then array(select jsonb_array_elements_text(new.raw_user_meta_data->'subjects_needed'))
         else '{}'::text[] end,
    new.raw_user_meta_data->>'child_level',
    coalesce((new.raw_user_meta_data->>'open_to_contact')::boolean, true)
  );

  if (new.raw_user_meta_data->>'role') = 'tutor' then
    insert into public.tutors (
      id, bio, subjects, levels, monthly_rate, modalities, availability, documents, verification_status
    ) values (
      new.id,
      coalesce(new.raw_user_meta_data->>'bio', ''),
      case when new.raw_user_meta_data->'subjects' is not null
           then array(select jsonb_array_elements_text(new.raw_user_meta_data->'subjects')) else '{}'::text[] end,
      case when new.raw_user_meta_data->'levels' is not null
           then array(select jsonb_array_elements_text(new.raw_user_meta_data->'levels')) else '{}'::text[] end,
      coalesce((new.raw_user_meta_data->>'monthly_rate')::integer, 0),
      case when new.raw_user_meta_data->'modalities' is not null
           then array(select jsonb_array_elements_text(new.raw_user_meta_data->'modalities')) else '{}'::text[] end,
      coalesce(new.raw_user_meta_data->'availability', '{}'::jsonb),
      coalesce(new.raw_user_meta_data->'documents', '{}'::jsonb),
      'pending'
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STORAGE (F1) — Restaure les policies documentées d'origine.
-- ⚠️ On NE remet PAS le bucket en public et on NE désactive PAS le
--    RLS : cela rouvrirait la fuite des documents KYC. Le rollback
--    restaure seulement le jeu de policies "owner + admin".
--    (Si une ancienne policy PERMISSIVE existait et causait la fuite,
--     elle n'est volontairement PAS recréée.)
-- ============================================================
drop policy if exists "documents_select_owner_or_admin" on storage.objects;
drop policy if exists "documents_insert_owner" on storage.objects;
drop policy if exists "documents_update_owner" on storage.objects;
drop policy if exists "documents_delete_owner_or_admin" on storage.objects;

drop policy if exists "Tuteur upload ses documents" on storage.objects;
create policy "Tuteur upload ses documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Tuteur lit ses documents" on storage.objects;
create policy "Tuteur lit ses documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Tuteur remplace ses documents" on storage.objects;
create policy "Tuteur remplace ses documents" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admin lit tous les documents" on storage.objects;
create policy "Admin lit tous les documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- ── Enfin : retirer le helper is_admin() (plus référencé après rollback) ──
drop function if exists public.is_admin();

-- ============================================================
-- Vérification : la recherche redevient ouverte (using(true)) et les
-- vues publiques n'existent plus. Pense à revenir au code précédent
-- (git) puisque l'app attend désormais public_tutors/public_profiles.
-- ============================================================
