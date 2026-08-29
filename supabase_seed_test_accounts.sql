-- ============================================================
-- MonRépétiteur — Comptes de TEST (parent + répétiteur)  v2 (corrigé)
-- À coller dans Supabase > SQL Editor > New query > Run
-- ------------------------------------------------------------
-- ✅ Idempotent — relançable sans doublon (corrige aussi un ancien run).
-- ✅ Normalise les colonnes de tokens auth.users (sinon GoTrue renvoie
--    500 "Database error querying schema" au login — piège des INSERT
--    manuels dans auth.users).
-- ✅ Passe le répétiteur en verified + abonné standard actif en
--    contournant le trigger protect_tutor_privileged_fields (seeding
--    en contexte admin/SQL — la protection reste active pour l'app).
-- ------------------------------------------------------------
-- Identifiants créés :
--   Parent     : parent.test@demo.ci     / demo123456
--   Répétiteur : repetiteur.test@demo.ci / demo123456
-- ============================================================

create extension if not exists pgcrypto;

DO $$
DECLARE
  v_parent_id uuid;
  v_tutor_id  uuid;
  v_pwd       text := 'demo123456';                 -- ← mot de passe des 2 comptes
BEGIN

-- ── 1) PARENT ────────────────────────────────────
SELECT id INTO v_parent_id FROM auth.users WHERE email = 'parent.test@demo.ci';
IF v_parent_id IS NULL THEN
  v_parent_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_parent_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'parent.test@demo.ci',
    crypt(v_pwd, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'role','parent','first_name','Fatou','last_name','Diallo',
      'phone','+225 07 88 99 00','city','Abidjan','quartier','Yopougon',
      'subjects_needed', jsonb_build_array('Mathématiques','Anglais'),
      'child_levels',    jsonb_build_array('3ème'),
      'open_to_contact', true
    ),
    now(), now()
  );
  RAISE NOTICE 'Parent créé : %', v_parent_id;
ELSE
  RAISE NOTICE 'Parent déjà existant : %', v_parent_id;
END IF;

UPDATE public.profiles SET
  role='parent', first_name='Fatou', last_name='Diallo',
  phone='+225 07 88 99 00', city='Abidjan', quartier='Yopougon', avatar_color='#E87722'
WHERE id = v_parent_id;

-- ── 2) RÉPÉTITEUR ────────────────────────────────
SELECT id INTO v_tutor_id FROM auth.users WHERE email = 'repetiteur.test@demo.ci';
IF v_tutor_id IS NULL THEN
  v_tutor_id := gen_random_uuid();
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    v_tutor_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'repetiteur.test@demo.ci',
    crypt(v_pwd, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'role','tutor','first_name','Yao','last_name','Kouassi',
      'phone','+225 07 55 66 77','city','Abidjan','quartier','Cocody',
      'bio','Enseignant de maths et physique, 6 ans d''expérience. Pédagogue et patient.',
      'subjects',   jsonb_build_array('Mathématiques','Physique-Chimie'),
      'levels',     jsonb_build_array('Collège','Lycée'),
      'monthly_rate', 30000,
      'modalities', jsonb_build_array('domicile_parent','en_ligne'),
      'availability', jsonb_build_object(
        'lundi', jsonb_build_array('16:00','18:00'),
        'mercredi', jsonb_build_array('14:00','16:00'),
        'samedi', jsonb_build_array('09:00','11:00'))
    ),
    now(), now()
  );
  RAISE NOTICE 'Répétiteur créé : %', v_tutor_id;
ELSE
  RAISE NOTICE 'Répétiteur déjà existant : %', v_tutor_id;
END IF;

UPDATE public.profiles SET
  role='tutor', first_name='Yao', last_name='Kouassi',
  phone='+225 07 55 66 77', city='Abidjan', quartier='Cocody', avatar_color='#2D6A4F'
WHERE id = v_tutor_id;

-- ── 3) FIX LOGIN : normalise les colonnes de tokens (NULL -> '') ──
--     Sans ça, GoTrue renvoie 500 "Database error querying schema".
UPDATE auth.users SET
  confirmation_token          = coalesce(confirmation_token, ''),
  recovery_token              = coalesce(recovery_token, ''),
  email_change                = coalesce(email_change, ''),
  email_change_token_new      = coalesce(email_change_token_new, ''),
  email_change_token_current  = coalesce(email_change_token_current, ''),
  phone_change                = coalesce(phone_change, ''),
  phone_change_token          = coalesce(phone_change_token, ''),
  reauthentication_token      = coalesce(reauthentication_token, ''),
  email_change_confirm_status = coalesce(email_change_confirm_status, 0)
WHERE id IN (v_parent_id, v_tutor_id);

END $$;


-- ── 4) SEED VÉRIFIÉ + ABONNÉ (contourne le trigger de protection) ──
alter table public.tutors disable trigger protect_tutor_privileged_fields;

update public.tutors t set
  bio                 = 'Enseignant de maths et physique, 6 ans d''expérience. Pédagogue et patient.',
  subjects            = ARRAY['Mathématiques','Physique-Chimie'],
  levels              = ARRAY['Collège','Lycée'],
  monthly_rate        = 30000,
  modalities          = ARRAY['domicile_parent','en_ligne'],
  verification_status = 'verified',
  subscription_plan   = 'standard',
  subscription_status = 'active',
  subscription_start  = current_date,
  subscription_end    = (current_date + interval '1 year')::date,
  is_active           = true,
  suspended           = false
from auth.users u
where u.id = t.id and u.email = 'repetiteur.test@demo.ci';

alter table public.tutors enable trigger protect_tutor_privileged_fields;


-- ── Vérification finale ──
SELECT u.email, p.role, p.first_name || ' ' || p.last_name AS nom,
       t.verification_status AS verif, t.subscription_plan AS abo,
       t.subscription_status AS abo_statut, t.is_active
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.tutors   t ON t.id = u.id
WHERE u.email IN ('parent.test@demo.ci','repetiteur.test@demo.ci')
ORDER BY p.role;


-- ============================================================
-- 🧹 SUPPRESSION (décommente puis Run pour effacer ces 2 comptes)
-- ============================================================
-- DELETE FROM auth.users WHERE email IN ('parent.test@demo.ci','repetiteur.test@demo.ci');
