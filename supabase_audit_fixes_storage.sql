-- ============================================================
-- MonRépétiteur — F1 : verrouillage du bucket "documents" (Storage)
--
-- ⚠️ À exécuter APRÈS supabase_audit_fixes.sql (qui crée is_admin()).
--
-- ⚠️ Selon les projets Supabase, l'éditeur SQL n'est PAS propriétaire de
--    storage.objects et renvoie « must be owner of table objects » sur
--    les CREATE/DROP POLICY. Dans ce cas, N'UTILISE PAS ce fichier :
--    passe par l'interface (voir méthode DASHBOARD ci-dessous).
--
-- Le passage du bucket en privé se fait TOUJOURS via l'interface
-- (Storage > documents > Edit bucket > décocher « Public bucket »).
-- ============================================================

-- Supprimer toute policy liée au bucket "documents"
-- (dont une éventuelle policy permissive anon/public = la fuite)
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual,'') ilike '%documents%' or coalesce(with_check,'') ilike '%documents%')
  loop
    execute format('drop policy if exists %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Recréer des policies STRICTES (aucune pour anon => anon bloqué)
create policy "documents_select_owner_or_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

create policy "documents_insert_owner" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents'
              and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documents_update_owner" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents'
         and (storage.foldername(name))[1] = auth.uid()::text);

create policy "documents_delete_owner_or_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ============================================================
-- MÉTHODE DASHBOARD (si le SQL ci-dessus échoue en 42501)
-- ------------------------------------------------------------
-- 1) Storage > Buckets > documents > (Edit bucket) :
--    décocher « Public bucket » puis Save.
--
-- 2) Storage > Policies (bucket documents) :
--    - SUPPRIMER toute policy dont le rôle cible est `anon`/`public`
--      ou dont l'expression est `true` (c'est la fuite).
--    - Vérifier/créer 4 policies, rôle cible = `authenticated` :
--
--    SELECT  (USING) :
--      bucket_id = 'documents'
--      and ((storage.foldername(name))[1] = auth.uid()::text
--           or exists (select 1 from public.profiles
--                      where id = auth.uid() and role = 'admin'))
--
--    INSERT  (WITH CHECK) :
--      bucket_id = 'documents'
--      and (storage.foldername(name))[1] = auth.uid()::text
--
--    UPDATE  (USING) : idem INSERT
--
--    DELETE  (USING) : idem SELECT
--
-- 3) Vérifier : une requête anonyme sur un fichier documents doit
--    renvoyer 400/403 (plus 200).
-- ============================================================
