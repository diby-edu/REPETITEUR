-- ============================================================
-- MonRépétiteur — Protection des colonnes sensibles (RLS)
--
-- Faille corrigée : les policies "auth.uid() = id" sur profiles et
-- tutors autorisent la mise à jour de N'IMPORTE QUELLE colonne de sa
-- propre ligne. Un utilisateur connecté pouvait donc, depuis la
-- console du navigateur :
--   - s'attribuer role = 'admin' sur son propre profil
--   - s'auto-vérifier / s'auto-activer / s'attribuer un abonnement
--     Premium sur sa propre ligne tutors, sans revue admin ni paiement
--
-- Ce script verrouille ces colonnes via un trigger BEFORE UPDATE qui
-- restaure la valeur précédente sauf si l'appelant est admin ou le
-- service_role (utilisé par le webhook PayDunya et les tâches serveur).
--
-- Exception volontaire : un répétiteur peut toujours repasser
-- lui-même en plan "gratuit" (aucun paiement requis, ne débloque
-- rien) et se désactiver lui-même — mais jamais s'activer ni
-- s'attribuer un plan payant hors du circuit de paiement.
--
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- ── PROFILES : verrouiller le champ "role" ────────────────────
create or replace function public.protect_profile_role()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

  new.role := old.role;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

-- ── TUTORS : verrouiller les champs gérés par l'admin / le paiement ──
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

  -- Auto-service : uniquement le repli vers le plan gratuit.
  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;

  -- Auto-service : se désactiver soi-même est permis, s'activer ne l'est pas.
  if new.is_active then
    new.is_active := old.is_active;
  end if;

  new.verification_status := old.verification_status;
  new.rejection_reason    := old.rejection_reason;
  new.rating               := old.rating;
  new.review_count         := old.review_count;
  new.session_count        := old.session_count;
  new.profile_views        := old.profile_views;
  new.monthly_requests     := old.monthly_requests;
  new.suspended            := old.suspended;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_tutor_privileged_fields on public.tutors;
create trigger protect_tutor_privileged_fields
  before update on public.tutors
  for each row execute procedure public.protect_tutor_privileged_fields();

-- ============================================================
-- Vérification rapide après exécution (à lancer séparément) :
--
-- 1) Connecté en tant que tuteur non-admin, ceci ne doit RIEN changer :
--    update public.tutors set verification_status = 'verified' where id = auth.uid();
--    select verification_status from public.tutors where id = auth.uid();
--
-- 2) Le flux admin (bouton Approuver/Rejeter/Valider dans /admin) et le
--    webhook PayDunya doivent continuer à fonctionner normalement.
-- ============================================================
