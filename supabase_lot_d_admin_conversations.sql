-- ============================================================
-- Lot D — Modération : l'admin peut lire TOUTES les conversations
--   Ajoute des policies SELECT réservées à l'admin sur
--   conversations et messages (lecture seule pour modération).
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- ============================================================

drop policy if exists "Admin voit toutes les conversations" on public.conversations;
create policy "Admin voit toutes les conversations" on public.conversations
  for select to authenticated using (public.is_admin());

drop policy if exists "Admin voit tous les messages" on public.messages;
create policy "Admin voit tous les messages" on public.messages
  for select to authenticated using (public.is_admin());
