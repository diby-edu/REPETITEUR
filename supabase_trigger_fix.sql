-- ============================================================
-- CORRECTIF TRIGGER handle_new_user
-- Problème : le trigger original ne créait PAS la ligne tutors
--            et ne sauvegardait pas phone/city/quartier/avatar_color
-- À exécuter dans : Supabase > SQL Editor > New query > Run
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insérer le profil complet (tous les champs)
  INSERT INTO public.profiles (
    id, role, first_name, last_name, email,
    phone, city, quartier, avatar_color,
    subjects_needed, child_level, open_to_contact
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'parent'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'quartier',
    COALESCE(new.raw_user_meta_data->>'avatar_color', '#E87722'),
    -- Champs parent
    CASE
      WHEN new.raw_user_meta_data->'subjects_needed' IS NOT NULL
      THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'subjects_needed'))
      ELSE '{}'::text[]
    END,
    new.raw_user_meta_data->>'child_level',
    COALESCE((new.raw_user_meta_data->>'open_to_contact')::boolean, true)
  );

  -- Si répétiteur : créer la ligne tutors avec toutes ses données
  IF (new.raw_user_meta_data->>'role') = 'tutor' THEN
    INSERT INTO public.tutors (
      id,
      bio,
      subjects,
      levels,
      monthly_rate,
      modalities,
      availability,
      documents,
      verification_status
    ) VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'bio', ''),
      CASE
        WHEN new.raw_user_meta_data->'subjects' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'subjects'))
        ELSE '{}'::text[]
      END,
      CASE
        WHEN new.raw_user_meta_data->'levels' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'levels'))
        ELSE '{}'::text[]
      END,
      COALESCE((new.raw_user_meta_data->>'monthly_rate')::integer, 0),
      CASE
        WHEN new.raw_user_meta_data->'modalities' IS NOT NULL
        THEN ARRAY(SELECT jsonb_array_elements_text(new.raw_user_meta_data->'modalities'))
        ELSE '{}'::text[]
      END,
      COALESCE(new.raw_user_meta_data->'availability', '{}'::jsonb),
      COALESCE(new.raw_user_meta_data->'documents', '{}'::jsonb),
      'pending'
    );
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Le trigger existe déjà, pas besoin de le recréer
-- (CREATE OR REPLACE FUNCTION suffit)

-- ============================================================
-- CORRECTIF : réparer l'utilisateur brazilbrazil1980@gmail.com
-- (profil existe mais ligne tutors manquante)
-- ============================================================

INSERT INTO public.tutors (
  id, bio, subjects, levels, monthly_rate,
  modalities, availability, documents, verification_status
)
SELECT
  p.id,
  '',
  '{}'::text[],
  '{}'::text[],
  0,
  '{}'::text[],
  '{}'::jsonb,
  '{}'::jsonb,
  'pending'
FROM public.profiles p
WHERE p.email = 'brazilbrazil1980@gmail.com'
  AND p.role = 'tutor'
ON CONFLICT (id) DO NOTHING;

-- Vérification : doit retourner 1 ligne avec verification_status = 'pending'
SELECT p.email, p.first_name, p.last_name, t.verification_status, t.documents
FROM public.profiles p
JOIN public.tutors t ON t.id = p.id
WHERE p.email = 'brazilbrazil1980@gmail.com';
