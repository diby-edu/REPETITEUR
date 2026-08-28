-- ============================================================
-- MonRépétiteur — Notifications : préférences réellement appliquées
--
-- create_notification consulte désormais notification_preferences du
-- destinataire et n'insère PAS si le type est désactivé. Les types
-- critiques (vérification, doc re-soumis, abonnement) sont toujours
-- envoyés (non mappés). Comportement par défaut inchangé si aucune
-- préférence enregistrée (null -> notification créée).
--
-- Remplace create_notification, idempotent.
-- ============================================================

create or replace function public.create_notification(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_message text,
  p_link    text default null
)
returns void as $$
declare
  prefs    jsonb;
  pref_key text;
begin
  -- Mapper le type de notification -> clé de préférence
  pref_key := case
    when p_type = 'new_message' then 'newMessage'
    when p_type in ('engagement_proposed','engagement_request','booking_request') then 'bookingRequest'
    when p_type in ('booking_confirmed','booking_rejected','booking_cancelled','review_invite') then 'bookingUpdate'
    when p_type = 'new_review' then 'reviewReceived'
    when p_type = 'tutor_interest' then 'tutorInterest'
    else null   -- types critiques : toujours envoyés
  end;

  if pref_key is not null then
    select notification_preferences into prefs from public.profiles where id = p_user_id;
    -- Préférence explicitement désactivée -> on ne crée pas la notification
    if prefs ? pref_key and (prefs ->> pref_key) = 'false' then
      return;
    end if;
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (p_user_id, p_type, p_title, p_message, p_link);
end;
$$ language plpgsql security definer;
