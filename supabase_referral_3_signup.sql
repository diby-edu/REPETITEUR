-- ============================================================
-- PARRAINAGE — Étape 3 : inscription (RPC)
--   • set_referrer(code)   : le nouveau répétiteur enregistre SON parrain
--        (une seule fois, pas d'auto-parrainage) — champ protégé
--   • founder_spots_left() : places fondateur restantes (urgence)
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- ============================================================

-- 1) Enregistrer son parrain (par code) — pour l'utilisateur courant ---
create or replace function public.set_referrer(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_me uuid := auth.uid();
begin
  if v_me is null or p_code is null or length(trim(p_code)) = 0 then return; end if;
  -- déjà un parrain ? immuable → on ne fait rien
  if exists (select 1 from public.tutors where id = v_me and referred_by is not null) then return; end if;
  -- retrouver le parrain via son code
  select id into v_ref from public.tutors where referral_code = upper(trim(p_code));
  if v_ref is null or v_ref = v_me then return; end if;   -- code inconnu ou auto-parrainage
  perform set_config('app.system_task','1',true);
  update public.tutors set referred_by = v_ref where id = v_me and referred_by is null;
end; $$;
revoke all on function public.set_referrer(text) from public;
grant execute on function public.set_referrer(text) to authenticated;

-- 2) Places fondateur restantes (null = illimité/désactivé) ------------
create or replace function public.founder_spots_left()
returns int language plpgsql security definer set search_path = public stable as $$
declare v_max int; v_used int;
begin
  select welcome_max_tutors into v_max from public.referral_config where id = 1;
  if v_max is null or v_max = 0 then return null; end if;
  select count(*)::int into v_used from public.tutors where welcome_claimed;
  return greatest(0, v_max - v_used);
end; $$;
grant execute on function public.founder_spots_left() to anon, authenticated;
