-- ============================================================
-- MonRépétiteur — Champs parent + trigger v3
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- 1. Ajouter les colonnes parent dans profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subjects_needed text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS child_level     text,
  ADD COLUMN IF NOT EXISTS open_to_contact boolean   DEFAULT true;

-- 2. Mettre à jour le trigger pour inclure ces champs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta      jsonb := new.raw_user_meta_data;
  user_role text  := coalesce(meta->>'role', 'parent');
BEGIN
  -- Insérer le profil complet
  INSERT INTO public.profiles (
    id, role, first_name, last_name, email, phone, city, quartier, avatar_color,
    subjects_needed, child_level, open_to_contact
  )
  VALUES (
    new.id,
    user_role,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    new.email,
    coalesce(meta->>'phone', null),
    coalesce(meta->>'city', null),
    coalesce(meta->>'quartier', null),
    coalesce(meta->>'avatar_color', '#E87722'),
    coalesce(
      array(SELECT jsonb_array_elements_text(meta->'subjects_needed')),
      ARRAY[]::text[]
    ),
    coalesce(meta->>'child_level', null),
    coalesce((meta->>'open_to_contact')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE SET
    phone            = coalesce(excluded.phone,            public.profiles.phone),
    city             = coalesce(excluded.city,             public.profiles.city),
    quartier         = coalesce(excluded.quartier,         public.profiles.quartier),
    avatar_color     = coalesce(excluded.avatar_color,     public.profiles.avatar_color),
    subjects_needed  = coalesce(excluded.subjects_needed,  public.profiles.subjects_needed),
    child_level      = coalesce(excluded.child_level,      public.profiles.child_level),
    open_to_contact  = coalesce(excluded.open_to_contact,  public.profiles.open_to_contact);

  -- Si répétiteur, créer la ligne tutors
  IF user_role = 'tutor' THEN
    INSERT INTO public.tutors (id, bio, subjects, levels, monthly_rate, modalities, availability, documents)
    VALUES (
      new.id,
      coalesce(meta->>'bio', ''),
      coalesce(array(SELECT jsonb_array_elements_text(meta->'subjects')),   ARRAY[]::text[]),
      coalesce(array(SELECT jsonb_array_elements_text(meta->'levels')),     ARRAY[]::text[]),
      coalesce((meta->>'monthly_rate')::integer, 0),
      coalesce(array(SELECT jsonb_array_elements_text(meta->'modalities')), ARRAY[]::text[]),
      coalesce(meta->'availability', '{}'::jsonb),
      coalesce(meta->'documents',    '{}'::jsonb)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recréer le trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
