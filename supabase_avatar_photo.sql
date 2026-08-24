-- ============================================================
-- Photo de profil obligatoire — colonne avatar_url + vues publiques
--   1) profiles.avatar_url : URL publique de la photo (bucket "avatars").
--   2) public_profiles + public_tutors : exposent avatar_url.
-- Idempotent. À lancer dans Supabase > SQL Editor.
--
-- ⚠️ Créer aussi le bucket de stockage (voir instructions in-app) :
--    Storage > New bucket > nom "avatars" > PUBLIC activé.
--    + policy d'upload pour les utilisateurs authentifiés.
-- ============================================================

alter table public.profiles
  add column if not exists avatar_url text;

-- Vue profils publics (+ avatar_url)
create or replace view public.public_profiles as
  select id, role, first_name, last_name, city, quartier, avatar_color, avatar_url,
         join_date, subjects_needed, child_level, child_levels, open_to_contact
  from public.profiles;
grant select on public.public_profiles to anon, authenticated;

-- Vue répétiteurs publics (version Lot 3 + avatar_url)
create or replace view public.public_tutors as
  select
    p.id, p.first_name, p.last_name, p.city, p.quartier, p.avatar_color, p.avatar_url, p.join_date,
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
