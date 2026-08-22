-- ============================================================
-- MonRépétiteur — Exposer les NOMS des diplômes approuvés sur la
-- fiche publique (⑤). On n'expose QUE les noms (jamais les chemins
-- de fichiers, ni CNI/passeport/selfie) → aucune fuite KYC.
--
-- À exécuter dans Supabase > SQL Editor > New query > Run
-- (après supabase_audit_fixes.sql qui a créé la vue public_tutors).
-- ============================================================

create or replace view public.public_tutors as
  select
    p.id, p.first_name, p.last_name, p.city, p.quartier, p.avatar_color, p.join_date,
    t.bio, t.subjects, t.levels, t.monthly_rate, t.modalities, t.availability,
    t.verification_status, t.rejection_reason,
    t.subscription_plan, t.subscription_start, t.subscription_end, t.subscription_status,
    t.rating, t.review_count, t.session_count, t.profile_views, t.monthly_requests,
    t.is_active, t.suspended,
    -- Noms des diplômes APPROUVÉS uniquement (pas de chemins de fichiers)
    (
      select coalesce(array_agg(d->>'name'), '{}'::text[])
      from jsonb_array_elements(coalesce(t.documents->'diplomes', '[]'::jsonb)) d
      where coalesce(d->'review'->>'status', '') = 'approved'
        and (d->>'name') is not null
    ) as diploma_names
  from public.profiles p
  join public.tutors t on t.id = p.id
  where p.role = 'tutor';

grant select on public.public_tutors to anon, authenticated;

-- Vérif : la vue ne doit PAS contenir de colonne 'documents' ni de chemins.
-- select * from public.public_tutors limit 1;
