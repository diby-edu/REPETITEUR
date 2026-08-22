-- ============================================================
-- REFONTE Lot 5B : compteur de séances faites (le parent coche)
-- Ajoute engagements.sessions_done (remis à 0 à chaque nouveau mois,
-- géré à la confirmation du paiement).
-- Sans risque (ajout). À lancer dans Supabase > SQL Editor > Run.
-- ============================================================

alter table public.engagements
  add column if not exists sessions_done int not null default 0;
