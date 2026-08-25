-- ============================================================
-- PARRAINAGE — Étape 4 : stats du parrain (pour le widget dashboard)
--   my_referral_stats() : tout ce dont le widget a besoin, en 1 appel.
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- ============================================================
create or replace function public.my_referral_stats()
returns table(
  code            text,
  is_founder      boolean,
  qualified_count int,
  pending_count   int,
  rewards_granted int,
  banked_days     int,
  has_paid        boolean,
  threshold       int,
  spots_left      int
)
language plpgsql security definer set search_path = public stable as $$
declare v_me uuid := auth.uid(); cfg public.referral_config%rowtype;
begin
  select * into cfg from public.referral_config where id = 1;
  return query
    select
      t.referral_code,
      t.is_founder,
      (select count(*)::int from public.tutors f where f.referred_by = v_me and f.referral_qualified),
      (select count(*)::int from public.tutors f where f.referred_by = v_me and not f.referral_qualified),
      t.referral_rewards_granted,
      t.reward_days_banked,
      t.has_paid_subscription,
      cfg.referral_threshold,
      public.founder_spots_left()
    from public.tutors t
    where t.id = v_me;
end; $$;
grant execute on function public.my_referral_stats() to authenticated;
