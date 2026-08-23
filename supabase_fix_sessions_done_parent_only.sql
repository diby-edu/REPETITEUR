-- ============================================================
-- DURCISSEMENT : "séances validées" = strictement côté PARENT
-- ------------------------------------------------------------
-- Contexte : engagements.sessions_done (Lot 5B) est le compteur
-- « X/N séances validées PAR LES PARENTS ». Or la policy UPDATE
-- « Modifier son engagement » autorise parent OU tuteur, et le
-- trigger protect_engagement_fields (écrit avant Lot 5B) ne
-- verrouille pas sessions_done. Un tuteur pourrait donc, via un
-- appel REST direct, gonfler son propre compteur (ex. 8/8) sans
-- validation réelle du parent — ce qui trahit le libellé.
--
-- Côté app, sessions_done n'est écrit QUE par setSessionsDone(),
-- appelé uniquement depuis le tableau de bord PARENT (le tuteur
-- l'affiche en lecture seule). Verrouiller ce champ pour le tuteur
-- ne casse donc AUCUN flux légitime — c'est de la défense en
-- profondeur (l'UI restreignait déjà, on l'enforce au niveau SGBD).
--
-- Admin / service_role : inchangés (remise à 0 à la confirmation
-- de paiement passe par une fonction SECURITY DEFINER, non bloquée).
--
-- Idempotent (CREATE OR REPLACE). À lancer dans Supabase > SQL Editor.
-- ============================================================

create or replace function public.protect_engagement_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  -- Champs immuables côté client
  new.parent_id    := old.parent_id;
  new.tutor_id     := old.tutor_id;
  new.subject      := old.subject;
  new.monthly_rate := old.monthly_rate;
  new.start_date   := old.start_date;
  new.created_at   := old.created_at;

  -- « Séances validées » : réservé au PARENT du contrat.
  -- Toute autre partie (le tuteur) ne peut pas modifier ce compteur.
  if auth.uid() <> old.parent_id then
    new.sessions_done := old.sessions_done;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Le trigger existant pointe déjà sur cette fonction ; rien d'autre à faire.
-- (Rappel : before update on public.engagements, per row.)
