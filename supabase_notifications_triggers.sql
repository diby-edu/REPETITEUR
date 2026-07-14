-- ============================================================
-- MonRépétiteur — Triggers de notifications automatiques
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- ── Fonction helper : créer une notification ────────────────
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null
)
returns void as $$
begin
  insert into public.notifications (user_id, type, title, message, link)
  values (p_user_id, p_type, p_title, p_message, p_link);
end;
$$ language plpgsql security definer;


-- ============================================================
-- TRIGGER 1 : Nouvelle réservation → notifier le tuteur
-- ============================================================
create or replace function public.notify_tutor_new_booking()
returns trigger as $$
declare
  parent_name text;
begin
  select first_name || ' ' || last_name into parent_name
  from public.profiles where id = NEW.parent_id;

  perform public.create_notification(
    NEW.tutor_id,
    'booking_request',
    'Nouvelle demande de séance',
    parent_name || ' demande une séance de ' || NEW.subject || ' le ' || to_char(NEW.date, 'DD/MM/YYYY') || ' à ' || NEW.time || '.',
    '/reservations'
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_created on public.bookings;
create trigger on_booking_created
  after insert on public.bookings
  for each row execute procedure public.notify_tutor_new_booking();


-- ============================================================
-- TRIGGER 2 : Changement de statut réservation
-- ============================================================
create or replace function public.notify_booking_status_change()
returns trigger as $$
declare
  tutor_name text;
  parent_name text;
begin
  if NEW.status = OLD.status then return NEW; end if;

  select first_name || ' ' || last_name into tutor_name
  from public.profiles where id = NEW.tutor_id;

  select first_name || ' ' || last_name into parent_name
  from public.profiles where id = NEW.parent_id;

  -- Confirmation → notifier le parent
  if NEW.status = 'confirmed' then
    perform public.create_notification(
      NEW.parent_id,
      'booking_confirmed',
      'Séance confirmée !',
      tutor_name || ' a confirmé votre séance de ' || NEW.subject || ' le ' || to_char(NEW.date, 'DD/MM/YYYY') || '.',
      '/reservations'
    );
  end if;

  -- Refus → notifier le parent
  if NEW.status = 'rejected' then
    perform public.create_notification(
      NEW.parent_id,
      'booking_rejected',
      'Séance refusée',
      tutor_name || ' n''a pas pu accepter votre séance de ' || NEW.subject || '.',
      '/reservations'
    );
  end if;

  -- Annulation par le parent → notifier le tuteur
  if NEW.status = 'cancelled' then
    perform public.create_notification(
      NEW.tutor_id,
      'booking_cancelled',
      'Séance annulée',
      parent_name || ' a annulé la séance de ' || NEW.subject || ' du ' || to_char(NEW.date, 'DD/MM/YYYY') || '.',
      '/reservations'
    );
  end if;

  -- Terminée → inviter le parent à laisser un avis
  if NEW.status = 'completed' then
    perform public.create_notification(
      NEW.parent_id,
      'review_invite',
      'Séance terminée — laissez un avis !',
      'Votre séance de ' || NEW.subject || ' avec ' || tutor_name || ' est terminée. Partagez votre expérience.',
      '/repetiteur/' || NEW.tutor_id
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_status_changed on public.bookings;
create trigger on_booking_status_changed
  after update of status on public.bookings
  for each row execute procedure public.notify_booking_status_change();


-- ============================================================
-- TRIGGER 3 : Nouvel avis → notifier le tuteur
-- ============================================================
create or replace function public.notify_tutor_new_review()
returns trigger as $$
declare
  stars text;
begin
  stars := repeat('★', NEW.rating) || repeat('☆', 5 - NEW.rating);

  perform public.create_notification(
    NEW.tutor_id,
    'new_review',
    'Nouvel avis reçu ' || stars,
    NEW.parent_name || ' a publié un avis ' || NEW.rating || '/5 sur votre profil.',
    '/repetiteur/' || NEW.tutor_id
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_review_created on public.reviews;
create trigger on_review_created
  after insert on public.reviews
  for each row execute procedure public.notify_tutor_new_review();


-- ============================================================
-- TRIGGER 4 : Changement de statut de vérification → notifier le tuteur
-- ============================================================
create or replace function public.notify_tutor_verification_change()
returns trigger as $$
begin
  if NEW.verification_status = OLD.verification_status then return NEW; end if;

  if NEW.verification_status = 'verified' then
    perform public.create_notification(
      NEW.id,
      'verification_approved',
      'Dossier approuvé !',
      'Félicitations ! Votre dossier a été validé. Choisissez un abonnement pour apparaître dans les recherches.',
      '/abonnement'
    );
  end if;

  if NEW.verification_status = 'rejected' then
    perform public.create_notification(
      NEW.id,
      'verification_rejected',
      'Dossier refusé',
      'Votre dossier n''a pas été approuvé. Motif : ' || coalesce(NEW.rejection_reason, 'Non précisé') || '. Contactez le support pour plus d''informations.',
      null
    );
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_tutor_verification_changed on public.tutors;
create trigger on_tutor_verification_changed
  after update of verification_status on public.tutors
  for each row execute procedure public.notify_tutor_verification_change();
