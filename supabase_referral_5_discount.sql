-- ============================================================
-- PARRAINAGE — Étape 5 : remise filleul (−50 % 1er mois payant)
--   referee_discount_for_me() : % de remise auquel le tuteur courant a
--   droit (0 si non éligible). Utilisé par la route PayDunya "initiate".
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- ============================================================
create or replace function public.referee_discount_for_me()
returns int language plpgsql security definer set search_path = public stable as $$
declare v_me uuid := auth.uid(); cfg public.referral_config%rowtype; t public.tutors%rowtype;
begin
  select * into cfg from public.referral_config where id = 1;
  if cfg.id is null or not cfg.referral_enabled then return 0; end if;
  select * into t from public.tutors where id = v_me;
  if t.id is null then return 0; end if;
  -- éligible : parrainé, jamais payé, remise pas encore utilisée
  if t.referred_by is not null and not t.has_paid_subscription and not t.referee_discount_used then
    return coalesce(cfg.referee_discount_pct, 0);
  end if;
  return 0;
end; $$;
grant execute on function public.referee_discount_for_me() to authenticated;
