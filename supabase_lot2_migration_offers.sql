-- ============================================================
-- REFONTE Lot 2 : migration des données existantes vers tutor_offers
-- Convertit (subjects + levels larges + monthly_rate) → offres par classe.
--   Primaire → 'primaire' (sans matières)
--   Collège  → 6e,5e,4e,3e (avec les matières existantes)
--   Lycée    → 2nde,1ere,tle (avec les matières existantes)
-- Idempotent (on conflict do nothing). À lancer APRÈS supabase_lot1_forfaits.sql.
-- ============================================================

insert into public.tutor_offers (tutor_id, level_key, subjects, monthly_price)
select
  t.id,
  m.level_key,
  case when lp.has_subjects then coalesce(t.subjects, '{}'::text[]) else '{}'::text[] end,
  coalesce(t.monthly_rate, 0)
from public.tutors t
cross join lateral (
  select unnest(
        case when 'Primaire' = any(t.levels) then array['primaire']          else array[]::text[] end
     || case when 'Collège'  = any(t.levels) then array['6e','5e','4e','3e']  else array[]::text[] end
     || case when 'Lycée'    = any(t.levels) then array['2nde','1ere','tle']  else array[]::text[] end
  ) as level_key
) m
join public.level_packages lp on lp.level_key = m.level_key
where coalesce(t.monthly_rate, 0) > 0
  and t.levels is not null
on conflict (tutor_id, level_key) do nothing;

-- Vérif : select tutor_id, level_key, monthly_price, subjects from public.tutor_offers order by tutor_id;
