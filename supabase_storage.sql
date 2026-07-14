-- ============================================================
-- MonRépétiteur — Supabase Storage : bucket "documents"
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- Créer le bucket "documents" (privé — accès via URL signées uniquement)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  5242880, -- 5 Mo max
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── Politiques RLS pour storage.objects ─────────────────────

-- 1. Un tuteur peut uploader dans son propre dossier
CREATE POLICY "Tuteur upload ses documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Un tuteur peut lire ses propres documents
CREATE POLICY "Tuteur lit ses documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Un tuteur peut remplacer ses documents (update)
CREATE POLICY "Tuteur remplace ses documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. L'admin peut lire tous les documents
CREATE POLICY "Admin lit tous les documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
