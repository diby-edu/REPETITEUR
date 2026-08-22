-- ============================================================
-- REFONTE Lot 3 : exposer les offres du répétiteur sur la vue publique
-- (pour la recherche par classe/matière + intervalle de prix côté parent).
-- Recrée public_tutors en ajoutant la colonne `offers`.
-- À lancer APRÈS Lot 1 + Lot 2. Aucun KYC exposé.
-- ============================================================

create or replace view public.public_tutors as
  select
    p.id, p.first_name, p.last_name, p.city, p.quartier, p.avatar_color, p.join_date,
    t.bio, t.subjects, t.levels, t.monthly_rate, t.modalities, t.availability,
    t.verification_status, t.rejection_reason,
    t.subscription_plan, t.subscription_start, t.subscription_end, t.subscription_status,
    t.rating, t.review_count, t.session_count, t.profile_views, t.monthly_requests,
    t.is_active, t.suspended,
    (
      select coalesce(array_agg(d->>'name'), '{}'::text[])
      from jsonb_array_elements(coalesce(t.documents->'diplomes', '[]'::jsonb)) d
      where t.verification_status = 'verified' and (d->>'name') is not null
    ) as diploma_names,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('level_key', o.level_key, 'subjects', o.subjects, 'monthly_price', o.monthly_price)
          order by o.monthly_price
        ),
        '[]'::jsonb)
      from public.tutor_offers o
      where o.tutor_id = p.id and o.active
    ) as offers
  from public.profiles p
  join public.tutors t on t.id = p.id
  where p.role = 'tutor';

grant select on public.public_tutors to anon, authenticated;
