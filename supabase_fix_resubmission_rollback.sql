-- ============================================================
-- ROLLBACK de supabase_fix_resubmission.sql
-- Restaure protect_tutor_privileged_fields dans sa version
-- d'origine (supabase_audit_fixes.sql) et retire la notification
-- de re-soumission.
-- ⚠️ Le backfill (dossiers passés de 'rejected' à 'pending')
--    n'est PAS réversible automatiquement — c'est une correction
--    de données voulue.
-- ============================================================


-- 1) protect_tutor_privileged_fields — version d'origine (F5/F12)
create or replace function public.protect_tutor_privileged_fields()
returns trigger as $$
begin
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;

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


-- 2) Retrait de la notification de re-soumission
drop trigger if exists on_tutor_docs_resubmitted on public.tutors;
drop function if exists public.notify_admin_docs_resubmitted();
