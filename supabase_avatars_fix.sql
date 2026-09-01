-- ============================================================
-- MonRépétiteur — FIX upload photo de profil (bucket "avatars")
-- Erreur visée : « new row violates row-level security policy »
-- À coller dans Supabase > SQL Editor > New query > Run.
-- ============================================================

-- 1) Le bucket existe et est PUBLIC (lecture des photos par tous)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 2) (Re)création des policies RLS sur storage.objects, restreintes au bucket avatars
drop policy if exists "Avatars read"   on storage.objects;
drop policy if exists "Avatars upload" on storage.objects;
drop policy if exists "Avatars update" on storage.objects;
drop policy if exists "Avatars delete" on storage.objects;

-- Lecture : publique (le bucket est public, mais on l'explicite)
create policy "Avatars read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Envoi (1er upload = INSERT) : tout utilisateur connecté
create policy "Avatars upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

-- Remplacement (upsert = UPDATE) : USING **et** WITH CHECK requis
create policy "Avatars update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');

-- 3) Vérification — doit lister 3 policies + le bucket public=true
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname ilike 'Avatars%'
order by policyname;

select id, public from storage.buckets where id = 'avatars';

-- ============================================================
-- ⚠️ Si ce script échoue avec « must be owner of table objects » :
--    les policies Storage se créent alors via le DASHBOARD →
--    Storage → bucket "avatars" → Policies → New policy :
--      • INSERT, rôle "authenticated", condition : bucket_id = 'avatars'
--      • UPDATE, rôle "authenticated", condition : bucket_id = 'avatars'
--      • SELECT, condition : bucket_id = 'avatars'
--    (et vérifier que le bucket "avatars" est bien marqué "Public").
-- ============================================================
