-- ============================================================
-- MonRépétiteur — Trigger handle_new_user v2
-- Gère TOUS les champs dès l'inscription (y compris email confirmation)
-- Coller dans SQL Editor > New query > Run
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta jsonb := new.raw_user_meta_data;
  user_role text := coalesce(meta->>'role', 'parent');
begin
  -- Insérer le profil complet
  insert into public.profiles (id, role, first_name, last_name, email, phone, city, quartier, avatar_color)
  values (
    new.id,
    user_role,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    new.email,
    coalesce(meta->>'phone', null),
    coalesce(meta->>'city', null),
    coalesce(meta->>'quartier', null),
    coalesce(meta->>'avatar_color', '#E87722')
  )
  on conflict (id) do update set
    phone         = coalesce(excluded.phone, public.profiles.phone),
    city          = coalesce(excluded.city, public.profiles.city),
    quartier      = coalesce(excluded.quartier, public.profiles.quartier),
    avatar_color  = coalesce(excluded.avatar_color, public.profiles.avatar_color);

  -- Si répétiteur, créer la ligne tutors
  if user_role = 'tutor' then
    insert into public.tutors (id, bio, subjects, levels, monthly_rate, modalities, availability, documents)
    values (
      new.id,
      coalesce(meta->>'bio', ''),
      coalesce(
        array(select jsonb_array_elements_text(meta->'subjects')),
        ARRAY[]::text[]
      ),
      coalesce(
        array(select jsonb_array_elements_text(meta->'levels')),
        ARRAY[]::text[]
      ),
      coalesce((meta->>'monthly_rate')::integer, 0),
      coalesce(
        array(select jsonb_array_elements_text(meta->'modalities')),
        ARRAY[]::text[]
      ),
      coalesce(meta->'availability', '{}'::jsonb),
      coalesce(meta->'documents', '{}'::jsonb)
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Recréer le trigger (drop + create pour éviter les doublons)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
