-- ============================================================
-- pg_cron — maintenance quotidienne (indépendante du trafic)
-- Prérequis : activer l'extension pg_cron (Dashboard > Database >
-- Extensions > pg_cron, schéma pg_catalog).
-- Exécuté une fois. Job "maintenance-quotidienne", tous les jours 02:00 UTC.
--   • expire_ended_engagements   : contrats échus → ended
--   • check_expiring_engagements : notif "règlement dans 3 jours"
--   • expire_lapsed_subscriptions: abonnement impayé → profil masqué,
--                                   contrats résiliés, notifs (dont message
--                                   parent drastique)
--   • notify_expiring_subscriptions : alerte J-3 / J-1 au répétiteur
-- Pour relancer : select cron.unschedule('maintenance-quotidienne'); puis rejouer.
-- ============================================================

select cron.schedule(
  'maintenance-quotidienne',
  '0 2 * * *',
  $$
    select public.expire_ended_engagements();
    select public.check_expiring_engagements();
    select public.expire_lapsed_subscriptions();
    select public.notify_expiring_subscriptions();
  $$
);
