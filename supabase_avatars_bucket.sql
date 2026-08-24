-- ============================================================
-- Bucket de stockage "avatars" (photos de profil) — public.
-- À lancer dans Supabase > SQL Editor. Idempotent.
-- (Créé en SQL car l'assistant n'a pas accès au Dashboard/clé admin.)
-- ============================================================

-- 1) Bucket public
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2) Upload / remplacement par les utilisateurs authentifiés
--    (lecture publique automatique car bucket public → pas de policy SELECT)
drop policy if exists "Avatars upload" on storage.objects;
create policy "Avatars upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "Avatars update" on storage.objects;
create policy "Avatars update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');
