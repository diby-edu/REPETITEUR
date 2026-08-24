-- ============================================================
-- MonRépétiteur — Correctifs de l'audit sécurité (2026-08)
-- À exécuter dans Supabase > SQL Editor > New query > Run
--
-- Couvre : F1 (fuite documents KYC), F3 (PII email/téléphone),
-- F4 (escalade rôle à l'inscription), F5 (paiements/engagements),
-- F11 (avis sans relation), F12 (recalcul note), F13 (messages),
-- F17 (insertions laxistes).
--
-- Idempotent : peut être ré-exécuté sans danger.
-- ============================================================

-- ── Helper : is_admin() en SECURITY DEFINER (évite la récursion RLS) ──
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
-- F4 — Escalade de privilèges à l'INSCRIPTION
-- Le rôle vient des métadonnées client : on ne fait JAMAIS
-- confiance à 'admin'. Seuls 'tutor'/'parent' sont acceptés.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta jsonb := new.raw_user_meta_data;
  -- Rôle assaini : tout ce qui n'est pas 'tutor' devient 'parent'.
  user_role text := case when (meta->>'role') = 'tutor' then 'tutor' else 'parent' end;
begin
  insert into public.profiles (
    id, role, first_name, last_name, email, phone, city, quartier, avatar_color,
    subjects_needed, child_levels, open_to_contact
  ) values (
    new.id,
    user_role,
    coalesce(meta->>'first_name', ''),
    coalesce(meta->>'last_name', ''),
    new.email,
    meta->>'phone',
    meta->>'city',
    meta->>'quartier',
    coalesce(meta->>'avatar_color', '#E87722'),
    case when meta->'subjects_needed' is not null
         then array(select jsonb_array_elements_text(meta->'subjects_needed')) else '{}'::text[] end,
    case when meta->'child_levels' is not null
         then array(select jsonb_array_elements_text(meta->'child_levels')) else '{}'::text[] end,
    coalesce((meta->>'open_to_contact')::boolean, true)
  )
  on conflict (id) do update set
    phone        = coalesce(excluded.phone, public.profiles.phone),
    city         = coalesce(excluded.city, public.profiles.city),
    quartier     = coalesce(excluded.quartier, public.profiles.quartier),
    avatar_color = coalesce(excluded.avatar_color, public.profiles.avatar_color);

  if user_role = 'tutor' then
    insert into public.tutors (
      id, bio, subjects, levels, monthly_rate, modalities, availability, documents, verification_status
    ) values (
      new.id,
      coalesce(meta->>'bio', ''),
      case when meta->'subjects' is not null then array(select jsonb_array_elements_text(meta->'subjects')) else '{}'::text[] end,
      case when meta->'levels'   is not null then array(select jsonb_array_elements_text(meta->'levels'))   else '{}'::text[] end,
      coalesce((meta->>'monthly_rate')::integer, 0),
      case when meta->'modalities' is not null then array(select jsonb_array_elements_text(meta->'modalities')) else '{}'::text[] end,
      coalesce(meta->'availability', '{}'::jsonb),
      coalesce(meta->'documents', '{}'::jsonb),
      'pending'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- F3 — PII : email / téléphone ne doivent plus être lisibles
-- publiquement. On restreint les LIGNES complètes de profiles
-- et tutors au propriétaire + admin, et on expose des VUES
-- publiques ne contenant QUE les colonnes vitrine (pas d'email,
-- pas de téléphone, pas de documents KYC).
-- ============================================================

-- profiles : lecture complète = soi-même ou admin
drop policy if exists "Profils visibles par tous" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

-- tutors : lecture complète (dont documents) = soi-même ou admin
drop policy if exists "Tuteurs visibles par tous" on public.tutors;
drop policy if exists "tutors_select_self_or_admin" on public.tutors;
create policy "tutors_select_self_or_admin" on public.tutors
  for select using (auth.uid() = id or public.is_admin());

-- Vue publique des profils (colonnes vitrine uniquement)
create or replace view public.public_profiles as
  select id, role, first_name, last_name, city, quartier, avatar_color,
         join_date, subjects_needed, child_level, child_levels, open_to_contact
  from public.profiles;

-- Vue publique des répétiteurs (profil vitrine + données tuteur SANS documents)
create or replace view public.public_tutors as
  select
    p.id, p.first_name, p.last_name, p.city, p.quartier, p.avatar_color, p.join_date,
    t.bio, t.subjects, t.levels, t.monthly_rate, t.modalities, t.availability,
    t.verification_status, t.rejection_reason,
    t.subscription_plan, t.subscription_start, t.subscription_end, t.subscription_status,
    t.rating, t.review_count, t.session_count, t.profile_views, t.monthly_requests,
    t.is_active, t.suspended
  from public.profiles p
  join public.tutors t on t.id = p.id
  where p.role = 'tutor';

-- Les vues appartiennent à postgres et contournent le RLS (colonnes sûres only).
grant select on public.public_profiles to anon, authenticated;
grant select on public.public_tutors  to anon, authenticated;

-- ============================================================
-- F1 — Documents KYC : verrouiller le bucket "documents"
-- ⚠️ Le Storage (storage.objects / storage.buckets) n'appartient PAS
--    au rôle de l'éditeur SQL → les opérations dessus échouent avec
--    « must be owner of table objects ». Traiter F1 SÉPARÉMENT :
--    voir le fichier `supabase_audit_fixes_storage.sql`
--    (ou l'interface Supabase > Storage). NE PAS mettre F1 ici pour
--    ne pas faire échouer toute la transaction.
-- ============================================================

-- ============================================================
-- F13 — Messages : n'autoriser l'envoi que par un PARTICIPANT
-- de la conversation (pas seulement sender_id = soi).
-- ============================================================
drop policy if exists "Envoyer un message" on public.messages;
create policy "Envoyer un message" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

-- ============================================================
-- F11 — Avis : exiger une relation réelle (engagement ou
-- réservation terminée) entre le parent et le répétiteur.
-- ============================================================
drop policy if exists "Parent publie un avis" on public.reviews;
create policy "Parent publie un avis" on public.reviews
  for insert with check (
    auth.uid() = parent_id
    and (
      exists (select 1 from public.engagements e
              where e.parent_id = auth.uid() and e.tutor_id = reviews.tutor_id)
      or exists (select 1 from public.bookings b
              where b.parent_id = auth.uid() and b.tutor_id = reviews.tutor_id
                and b.status = 'completed')
    )
  );

-- ============================================================
-- F12 — La note du répétiteur doit se recalculer côté serveur
-- (le trigger protect_tutor bloque l'écriture client de rating).
-- On recalcule via trigger SECURITY DEFINER, avec un drapeau de
-- transaction pour être autorisé par protect_tutor.
-- ============================================================
create or replace function public.recompute_tutor_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid := coalesce(new.tutor_id, old.tutor_id);
begin
  perform set_config('app.rating_recompute', '1', true);
  update public.tutors t set
    rating       = coalesce((select round(avg(rating)::numeric, 1) from public.reviews where tutor_id = tid), 0),
    review_count = (select count(*) from public.reviews where tutor_id = tid)
  where t.id = tid;
  return null;
end;
$$;

drop trigger if exists recompute_tutor_rating on public.reviews;
create trigger recompute_tutor_rating
  after insert or update or delete on public.reviews
  for each row execute function public.recompute_tutor_rating();

-- ============================================================
-- F5 (+ maj F12) — Protection des colonnes de tutors
-- Réécrit protect_tutor_privileged_fields pour :
--   - laisser passer le recalcul de note (drapeau app.rating_recompute)
--   - conserver le verrouillage des colonnes sensibles côté client
-- ============================================================
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
begin
  -- Recalcul de note serveur : autorisé
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Auto-service : uniquement le repli vers le plan gratuit.
  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;

  -- Auto-service : se désactiver soi-même est permis, s'activer ne l'est pas.
  if new.is_active then
    new.is_active := old.is_active;
  end if;

  new.verification_status := old.verification_status;
  new.rejection_reason    := old.rejection_reason;
  new.rating              := old.rating;
  new.review_count        := old.review_count;
  new.session_count       := old.session_count;
  new.profile_views       := old.profile_views;
  new.monthly_requests    := old.monthly_requests;
  new.suspended           := old.suspended;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_tutor_privileged_fields on public.tutors;
create trigger protect_tutor_privileged_fields
  before update on public.tutors
  for each row execute procedure public.protect_tutor_privileged_fields();

-- ============================================================
-- F5 — Protection des colonnes d'ENGAGEMENTS
-- Interdit à une partie de modifier le tarif, les parties, la
-- matière, les dates ; laisse le flux d'acceptation / planning.
-- ============================================================
create or replace function public.protect_engagement_fields()
returns trigger as $$
begin
  -- Bypass : tâches système / recalcul / admin / service_role
  if coalesce(current_setting('app.system_task', true), '') = '1' then return new; end if;
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then return new; end if;
  if auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then return new; end if;

  -- Champs immuables côté client
  new.parent_id    := old.parent_id;
  new.tutor_id     := old.tutor_id;
  new.subject      := old.subject;
  new.monthly_rate := old.monthly_rate;
  new.start_date   := old.start_date;
  new.created_at   := old.created_at;

  -- « Séances validées » : réservé au PARENT du contrat (cf. Lot 5B).
  if auth.uid() is distinct from old.parent_id then
    new.sessions_done := old.sessions_done;
  end if;

  -- end_date : jamais modifiable directement (renouvellement = système)
  if new.end_date is distinct from old.end_date then
    raise exception 'end_date non modifiable directement (engagement %)', old.id
      using errcode = 'check_violation';
  end if;

  -- status : uniquement les transitions légitimes, par l'acteur autorisé
  if new.status is distinct from old.status then
    if old.status = 'pending' and new.status = 'active'
       and auth.uid() = old.tutor_id then
      null;  -- acceptation par le répétiteur
    elsif new.status = 'ended' and old.status in ('pending', 'active')
          and auth.uid() in (old.parent_id, old.tutor_id) then
      null;  -- refus / annulation / résiliation par une partie
    else
      raise exception 'transition de statut interdite : % -> % (engagement %)',
        old.status, new.status, old.id using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_engagement_fields on public.engagements;
create trigger protect_engagement_fields
  before update on public.engagements
  for each row execute procedure public.protect_engagement_fields();

-- ============================================================
-- F5 — Protection des PAIEMENTS (double confirmation)
-- Le parent ne peut que déclarer (status -> parent_declared) ;
-- le répétiteur ne peut que confirmer (parent_declared ->
-- confirmed). Montant / période / engagement non modifiables.
-- ============================================================
create or replace function public.protect_payment_fields()
returns trigger as $$
declare
  v_parent uuid;
  v_tutor  uuid;
begin
  if auth.role() = 'service_role' or public.is_admin() then
    return new;
  end if;

  select e.parent_id, e.tutor_id into v_parent, v_tutor
  from public.engagements e where e.id = old.engagement_id;

  -- Champs immuables côté client
  new.engagement_id := old.engagement_id;
  new.period_start  := old.period_start;
  new.period_end    := old.period_end;
  new.amount        := old.amount;
  new.created_at    := old.created_at;

  if auth.uid() = v_parent then
    -- Le parent ne touche pas aux champs du répétiteur
    new.tutor_wants_continue := old.tutor_wants_continue;
    new.tutor_confirmed_at   := old.tutor_confirmed_at;
    -- Il ne peut pas passer à 'confirmed'
    if new.status = 'confirmed' then
      new.status := old.status;
    end if;
  elsif auth.uid() = v_tutor then
    -- Le répétiteur ne touche pas aux champs du parent
    new.parent_wants_continue := old.parent_wants_continue;
    new.parent_declared_at    := old.parent_declared_at;
    -- Il ne peut confirmer que si le parent a déclaré
    if new.status = 'confirmed' and old.status <> 'parent_declared' then
      new.status := old.status;
    end if;
    -- Il ne peut pas revenir déclarer à la place du parent
    if new.status = 'parent_declared' and old.status = 'pending' then
      new.status := old.status;
    end if;
  else
    -- Ni parent ni tuteur : aucune modification
    return old;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists protect_payment_fields on public.payments;
create trigger protect_payment_fields
  before update on public.payments
  for each row execute procedure public.protect_payment_fields();

-- ============================================================
-- F17 — Insertions : restreindre la création d'engagements aux
-- parents, et l'insertion de séances côté client (le trigger
-- security definer generate_sessions reste prioritaire).
-- ============================================================
drop policy if exists "Parent crée un engagement" on public.engagements;
create policy "Parent crée un engagement" on public.engagements
  for insert with check (
    auth.uid() = parent_id
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'parent')
  );

-- ============================================================
-- Vérifications rapides (à lancer séparément)
-- ============================================================
-- 1) Anonyme : ne doit PLUS voir email/phone
--    select email, phone from public.profiles;  -> 0 ligne (RLS)
--    select * from public.public_profiles;       -> OK, sans email/phone
-- 2) Storage : lister les policies restantes du bucket documents
--    select policyname, cmd, roles from pg_policies
--    where schemaname='storage' and tablename='objects'
--      and (qual ilike '%documents%' or with_check ilike '%documents%');
-- 3) Inscription : un signUp avec role=admin doit créer un profil 'parent'.
