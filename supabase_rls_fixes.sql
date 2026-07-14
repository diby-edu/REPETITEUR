-- ============================================================
-- MonRépétiteur — Corrections des politiques RLS
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- ── 1. Notifications : restreindre l'insertion client-side ──
-- Les triggers (security definer) contournent le RLS.
-- Seul l'admin peut créer des notifs manuellement côté client.
DROP POLICY IF EXISTS "Créer une notification" ON public.notifications;

CREATE POLICY "Admin peut créer des notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 2. Notifications : permettre la suppression ──────────────
DROP POLICY IF EXISTS "Supprimer ses notifications" ON public.notifications;

CREATE POLICY "Supprimer ses notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ── 3. Bookings : admin peut modifier le statut ──────────────
DROP POLICY IF EXISTS "Admin modifie les réservations" ON public.bookings;

CREATE POLICY "Admin modifie les réservations"
ON public.bookings FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 4. Tutors : permettre la suppression par admin ───────────
DROP POLICY IF EXISTS "Admin supprime un tuteur" ON public.tutors;

CREATE POLICY "Admin supprime un tuteur"
ON public.tutors FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 5. Profils : permettre à l'admin de modifier n'importe quel profil
DROP POLICY IF EXISTS "Admin modifie les profils" ON public.profiles;

CREATE POLICY "Admin modifie les profils"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 6. Reviews : permettre suppression par auteur ou admin ───
DROP POLICY IF EXISTS "Auteur ou admin supprime un avis" ON public.reviews;

CREATE POLICY "Auteur ou admin supprime un avis"
ON public.reviews FOR DELETE
TO authenticated
USING (
  auth.uid() = parent_id
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ── 7. Favorites : permettre suppression par admin ───────────
-- (déjà ok pour parent via la policy existante)

-- ── 8. Vérifier que le trigger handle_new_user n'est pas dupliqué ──
-- Si vous avez des erreurs "duplicate key" lors de l'inscription,
-- c'est que le trigger essaie de créer un profil qui existe déjà.
-- Ce SELECT permet de vérifier les triggers actifs :
-- SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE tgname = 'on_auth_user_created';
