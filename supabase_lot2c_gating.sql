-- ============================================================
-- MonRépétiteur — Lot 2c : payer-pour-accepter (garde serveur)
--
-- Un répétiteur ne peut faire passer un de ses engagements à
-- 'active' (= accepter la demande) que s'il a un abonnement
-- PAYANT ACTIF. Sinon → exception (l'UI le redirige vers /abonnement).
-- Admin / service_role / renouvellements système ne sont pas concernés
-- (auth.uid() != tutor_id).
--
-- Ajout uniquement, idempotent.
-- ============================================================

create or replace function public.enforce_subscription_on_accept()
returns trigger as $$
declare
  sub_ok boolean;
begin
  if new.status = 'active'
     and old.status is distinct from 'active'
     and auth.uid() = old.tutor_id then
    select (subscription_status = 'active' and subscription_plan is distinct from 'gratuit')
      into sub_ok
    from public.tutors
    where id = old.tutor_id;

    if not coalesce(sub_ok, false) then
      raise exception 'SUBSCRIPTION_REQUIRED'
        using message = 'Un abonnement payant actif est requis pour accepter une demande.',
              errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists enforce_subscription_on_accept on public.engagements;
create trigger enforce_subscription_on_accept
  before update on public.engagements
  for each row execute function public.enforce_subscription_on_accept();
