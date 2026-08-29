-- ============================================================
-- MonRépétiteur — Suspension (S1-A blocage login + S2 suspendre un parent)
-- À coller dans Supabase > SQL Editor > New query > Run
-- ------------------------------------------------------------
-- • profiles.suspended : blocage dur du login (tous rôles).
-- • protect_profile_role : empêche l'auto-(dé)suspension (comme le rôle).
-- • admin_set_user_suspended(uuid, bool) : RPC admin qui pose suspended
--   sur profiles (login) ET tutors (masque la recherche) en un appel.
-- Idempotent.
-- ============================================================

-- 1) Colonne suspended sur profiles (blocage login, tous rôles)
alter table public.profiles
  add column if not exists suspended boolean not null default false;

-- 2) Protéger role ET suspended contre l'auto-modification (non-admin)
create or replace function public.protect_profile_role()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    return new;
  end if;

  -- non-admin : on restaure les colonnes sensibles
  new.role      := old.role;
  new.suspended := old.suspended;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

-- 3) RPC admin : suspendre / réactiver un utilisateur
--    Pose suspended sur profiles (login) + tutors (recherche) en une fois.
--    security definer + garde admin ; passe les triggers de protection
--    (l'appelant admin est reconnu par auth.uid()).
create or replace function public.admin_set_user_suspended(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'FORBIDDEN' using message = 'Réservé aux administrateurs.';
  end if;

  update public.profiles set suspended = p_suspended where id = p_user;
  -- si l'utilisateur est un répétiteur : le retirer / réintégrer à la recherche
  update public.tutors set suspended = p_suspended where id = p_user;
end;
$$;

revoke all on function public.admin_set_user_suspended(uuid, boolean) from public;
grant execute on function public.admin_set_user_suspended(uuid, boolean) to authenticated;

-- ── Vérification (optionnel) ──
-- select id, email, role, suspended from public.profiles where suspended;
