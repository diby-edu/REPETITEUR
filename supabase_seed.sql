-- ============================================================
-- MonRépétiteur — Seed des comptes démo (version corrigée)
-- Coller dans SQL Editor > New query > Run
-- ⚠️  Exécuter APRÈS supabase_schema.sql
-- ============================================================

create extension if not exists pgcrypto;

DO $$
DECLARE
  parent_id   uuid;
  tutor1_id   uuid;
  tutor2_id   uuid;
  admin_id    uuid;
BEGIN

-- ────────────────────────────────────────────────
-- 1. PARENT : parent@demo.ci
-- ────────────────────────────────────────────────
SELECT id INTO parent_id FROM auth.users WHERE email = 'parent@demo.ci';

IF parent_id IS NULL THEN
  parent_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    parent_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'parent@demo.ci',
    crypt('demo123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"parent","first_name":"Awa","last_name":"Koné"}',
    now(), now()
  );
  RAISE NOTICE 'Compte parent créé : %', parent_id;
ELSE
  RAISE NOTICE 'Compte parent déjà existant : %', parent_id;
END IF;

UPDATE public.profiles SET
  first_name   = 'Awa',
  last_name    = 'Koné',
  phone        = '+225 07 00 11 22',
  city         = 'Abidjan',
  quartier     = 'Cocody',
  avatar_color = '#E87722'
WHERE id = parent_id;


-- ────────────────────────────────────────────────
-- 2. RÉPÉTITEUR VÉRIFIÉ PREMIUM : repetiteur@demo.ci
-- ────────────────────────────────────────────────
SELECT id INTO tutor1_id FROM auth.users WHERE email = 'repetiteur@demo.ci';

IF tutor1_id IS NULL THEN
  tutor1_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    tutor1_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'repetiteur@demo.ci',
    crypt('demo123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"tutor","first_name":"Koné","last_name":"Amadou"}',
    now(), now()
  );
  RAISE NOTICE 'Compte répétiteur 1 créé : %', tutor1_id;
ELSE
  RAISE NOTICE 'Compte répétiteur 1 déjà existant : %', tutor1_id;
END IF;

UPDATE public.profiles SET
  first_name   = 'Koné',
  last_name    = 'Amadou',
  phone        = '+225 07 01 23 45',
  city         = 'Abidjan',
  quartier     = 'Cocody',
  avatar_color = '#2D6A4F'
WHERE id = tutor1_id;

INSERT INTO public.tutors (
  id, bio, subjects, levels, monthly_rate, modalities, availability,
  verification_status, documents,
  subscription_plan, subscription_start, subscription_end, subscription_status,
  rating, review_count, session_count, profile_views, monthly_requests, is_active
) VALUES (
  tutor1_id,
  'Enseignant passionné avec plus de 8 ans d''expérience en mathématiques et physique. Diplômé de l''École Polytechnique d''Abidjan.',
  ARRAY['Mathématiques', 'Physique-Chimie', 'Informatique'],
  ARRAY['Collège', 'Lycée', 'Supérieur'],
  45000,
  ARRAY['domicile_parent', 'domicile_repetiteur', 'lieu_neutre', 'en_ligne'],
  '{"lundi":["08:00","14:00","16:00"],"mardi":["08:00","14:00"],"mercredi":["08:00","10:00","14:00","16:00"],"jeudi":["14:00","16:00"],"vendredi":["08:00","14:00"],"samedi":["08:00","10:00","14:00"],"dimanche":[]}',
  'verified',
  '{"cni":true,"diplomes":["Diplôme Ingénieur Polytechnique","CAPES Mathématiques"]}',
  'premium', '2025-01-01', '2025-12-31', 'active',
  4.8, 42, 186, 234, 18, true
) ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────
-- 3. RÉPÉTITEUR EN ATTENTE : repetiteur2@demo.ci
-- ────────────────────────────────────────────────
SELECT id INTO tutor2_id FROM auth.users WHERE email = 'repetiteur2@demo.ci';

IF tutor2_id IS NULL THEN
  tutor2_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    tutor2_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'repetiteur2@demo.ci',
    crypt('demo123456', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"tutor","first_name":"Traoré","last_name":"Ibrahima"}',
    now(), now()
  );
  RAISE NOTICE 'Compte répétiteur 2 créé : %', tutor2_id;
ELSE
  RAISE NOTICE 'Compte répétiteur 2 déjà existant : %', tutor2_id;
END IF;

UPDATE public.profiles SET
  first_name   = 'Traoré',
  last_name    = 'Ibrahima',
  phone        = '+226 70 34 56 78',
  city         = 'Ouagadougou',
  quartier     = 'Hamdalaye',
  avatar_color = '#9B59B6'
WHERE id = tutor2_id;

INSERT INTO public.tutors (
  id, bio, subjects, levels, monthly_rate, modalities,
  verification_status, subscription_plan, subscription_status, is_active
) VALUES (
  tutor2_id,
  'Ingénieur informaticien et enseignant passionné. Spécialisé en mathématiques appliquées et informatique.',
  ARRAY['Mathématiques', 'Informatique'],
  ARRAY['Lycée', 'Supérieur'],
  25000,
  ARRAY['domicile_parent', 'lieu_neutre', 'en_ligne'],
  'pending', 'standard', 'active', false
) ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────
-- 4. ADMIN : konointer@gmail.com (compte existant)
-- ────────────────────────────────────────────────
SELECT id INTO admin_id FROM auth.users WHERE email = 'konointer@gmail.com';

IF admin_id IS NOT NULL THEN
  INSERT INTO public.profiles (id, role, first_name, last_name, email, avatar_color)
  VALUES (admin_id, 'admin', 'Admin', 'MonRépétiteur', 'konointer@gmail.com', '#F4A61D')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';
  RAISE NOTICE 'Compte admin configuré : %', admin_id;
ELSE
  RAISE WARNING 'konointer@gmail.com introuvable — connecte-toi d''abord via Google/email sur l''app.';
END IF;

END $$;


-- ────────────────────────────────────────────────
-- Vérification finale
-- ────────────────────────────────────────────────
SELECT
  u.email,
  p.role,
  p.first_name || ' ' || p.last_name AS nom,
  p.city,
  CASE WHEN t.id IS NOT NULL THEN t.verification_status ELSE '—' END AS statut_tutor
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.tutors t ON t.id = u.id
WHERE u.email IN ('parent@demo.ci', 'repetiteur@demo.ci', 'repetiteur2@demo.ci', 'konointer@gmail.com')
ORDER BY p.role;
