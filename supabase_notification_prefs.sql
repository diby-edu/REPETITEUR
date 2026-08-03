-- Ajouter la colonne notification_preferences aux profils
-- À exécuter dans Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{
    "newMessage": true,
    "bookingRequest": true,
    "bookingUpdate": true,
    "reviewReceived": true,
    "subscriptionExpiry": true,
    "profileViews": false
  }'::jsonb;
