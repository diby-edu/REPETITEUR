-- ============================================================
-- PARRAINAGE — Étape 2 : fonctions & sécurité (SECURITY DEFINER)
--   • grant_founder_status  : place fondateur à la vérification
--   • founder_first_contract: au 1er contrat actif → 7 j pour payer
--   • activate_paid_subscription : paiement réel → qualifie le filleul,
--        applique/banque les récompenses, marque le 1er paiement
--   • credit_referrer       : crédite le parrain (+30 j / 3 filleuls)
--   • protect_tutor_privileged_fields : verrou anti-fraude des drapeaux
-- Toutes posent le drapeau app.system_task pour passer les protections.
-- Idempotent. À TESTER avec supabase_referral_2_test.sql avant usage.
-- ============================================================

-- 1) Place fondateur à la vérification -------------------------------
create or replace function public.grant_founder_status(p_tutor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cfg public.referral_config%rowtype; n int;
begin
  select * into cfg from public.referral_config where id = 1;
  if cfg.id is null or not cfg.welcome_enabled then return; end if;

  -- déjà servi ?
  if exists (select 1 from public.tutors where id = p_tutor and welcome_claimed) then return; end if;
  -- places restantes ? (0 = illimité)
  select count(*) into n from public.tutors where welcome_claimed;
  if cfg.welcome_max_tutors > 0 and n >= cfg.welcome_max_tutors then return; end if;

  perform set_config('app.system_task','1',true);
  update public.tutors set
    is_founder            = true,
    welcome_claimed       = true,
    subscription_plan     = 'standard',
    subscription_status   = 'active',
    subscription_is_promo = true,          -- offert → ne compte pas pour le parrainage
    subscription_start    = current_date,
    subscription_end      = null,          -- gratuit "jusqu'au 1er contrat" (pas d'échéance date)
    is_active             = true
  where id = p_tutor and verification_status = 'verified';
end;
$$;

create or replace function public.on_tutor_verified()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status = 'verified' and old.verification_status is distinct from 'verified' then
    perform public.grant_founder_status(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists on_tutor_verified on public.tutors;
create trigger on_tutor_verified after update on public.tutors
  for each row execute function public.on_tutor_verified();

-- 2) Conversion fondateur : 1er contrat actif → délai de grâce -------
create or replace function public.founder_first_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare cfg public.referral_config%rowtype; t public.tutors%rowtype;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    select * into t from public.tutors where id = new.tutor_id;
    if t.is_founder and t.subscription_is_promo and t.subscription_end is null then
      select * into cfg from public.referral_config where id = 1;
      perform set_config('app.system_task','1',true);
      update public.tutors set subscription_end = current_date + coalesce(cfg.welcome_grace_days, 7)
        where id = new.tutor_id;
      insert into public.notifications (user_id, type, title, message, link)
      values (new.tutor_id, 'subscription', 'Votre 1er élève ! 🎉',
        'Félicitations, vous avez décroché un contrat. Abonnez-vous sous ' ||
        coalesce(cfg.welcome_grace_days, 7) || ' jours pour le conserver — sinon le profil et le contrat seront suspendus.',
        '/abonnement');
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists founder_first_contract on public.engagements;
create trigger founder_first_contract after update on public.engagements
  for each row execute function public.founder_first_contract();

-- 3) Crédit du parrain (+30 j par tranche de 3 filleuls qualifiés) ---
create or replace function public.credit_referrer(p_referrer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cfg public.referral_config%rowtype;
  r public.tutors%rowtype;
  v_qualified int; v_earned int; v_new int; v_days int;
begin
  select * into cfg from public.referral_config where id = 1;
  if cfg.id is null or not cfg.referral_enabled then return; end if;
  select * into r from public.tutors where id = p_referrer;
  if r.id is null then return; end if;

  select count(*) into v_qualified
    from public.tutors where referred_by = p_referrer and referral_qualified;
  v_earned := v_qualified / cfg.referral_threshold;          -- division entière
  v_new := v_earned - r.referral_rewards_granted;
  if v_new <= 0 then return; end if;
  v_days := v_new * cfg.referral_reward_days;

  perform set_config('app.system_task','1',true);
  if r.has_paid_subscription then
    -- encaissement direct : prolonge l'abonnement
    update public.tutors set
      referral_rewards_granted = v_earned,
      subscription_end = greatest(current_date, coalesce(subscription_end, current_date)) + v_days
    where id = p_referrer;
  else
    -- en réserve : appliqué au 1er paiement
    update public.tutors set
      referral_rewards_granted = v_earned,
      reward_days_banked = reward_days_banked + v_days
    where id = p_referrer;
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  values (p_referrer, 'referral', 'Parrainage récompensé 🎉',
    v_new || ' mois offert' || case when v_new > 1 then 's' else '' end ||
    case when r.has_paid_subscription then ' ajouté(s) à votre abonnement !'
         else ' en réserve — ils s''appliqueront dès votre 1er paiement.' end,
    '/abonnement');
end;
$$;

-- 4) Activation d'un abonnement PAYANT (admin / PayDunya) ------------
create or replace function public.activate_paid_subscription(p_tutor uuid, p_plan text, p_months int default 1)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tutors%rowtype; v_end date; v_first boolean;
begin
  -- Réservé à l'administration / au webhook de paiement / aux tâches système.
  -- (Un client ne peut pas poser app.system_task via REST → protection effective.)
  if not (public.is_admin() or auth.role() = 'service_role'
          or coalesce(current_setting('app.system_task', true), '') = '1') then
    raise exception 'Activation réservée à l''administration.';
  end if;
  perform set_config('app.system_task','1',true);
  select * into t from public.tutors where id = p_tutor;
  if t.id is null then return; end if;

  v_first := not t.has_paid_subscription;
  v_end := greatest(current_date, coalesce(t.subscription_end, current_date)) + (coalesce(p_months,1) * 30);
  if v_first and t.reward_days_banked > 0 then
    v_end := v_end + t.reward_days_banked;   -- récompenses en réserve appliquées au 1er paiement
  end if;

  update public.tutors set
    subscription_plan     = p_plan,
    subscription_status   = 'active',
    subscription_is_promo = false,           -- vrai mois payé
    subscription_start    = coalesce(subscription_start, current_date),
    subscription_end      = v_end,
    is_active             = (t.verification_status = 'verified'),
    has_paid_subscription = true,
    reward_days_banked    = case when v_first then 0 else t.reward_days_banked end,
    referee_discount_used = case when t.referred_by is not null and v_first then true else referee_discount_used end
  where id = p_tutor;

  -- qualifier le parrainage : ce tuteur paie son 1er vrai mois
  if v_first and t.referred_by is not null and not t.referral_qualified then
    update public.tutors set referral_qualified = true where id = p_tutor;
    perform public.credit_referrer(t.referred_by);
  end if;
end;
$$;
-- Sécurité : accès restreint (le garde-fou interne vérifie admin/service_role)
revoke all on function public.activate_paid_subscription(uuid, text, int) from public;
grant execute on function public.activate_paid_subscription(uuid, text, int) to authenticated;
-- Fonctions internes : jamais appelées directement par un client
revoke all on function public.grant_founder_status(uuid) from public;
revoke all on function public.credit_referrer(uuid) from public;

-- 5) Verrou anti-fraude : figer les drapeaux parrainage/fondateur ----
create or replace function public.protect_tutor_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.rating_recompute', true), '') = '1' then return new; end if;
  if coalesce(current_setting('app.system_task', true), '') = '1' then return new; end if;
  if auth.role() = 'service_role' then return new; end if;
  if public.is_admin() then return new; end if;

  if new.subscription_plan is distinct from 'gratuit' then
    new.subscription_plan   := old.subscription_plan;
    new.subscription_start  := old.subscription_start;
    new.subscription_end    := old.subscription_end;
    new.subscription_status := old.subscription_status;
  end if;
  if new.is_active then new.is_active := old.is_active; end if;
  new.verification_status := old.verification_status;
  new.rejection_reason    := old.rejection_reason;
  new.rating              := old.rating;
  new.review_count        := old.review_count;
  new.session_count       := old.session_count;
  new.profile_views       := old.profile_views;
  new.monthly_requests    := old.monthly_requests;
  new.suspended           := old.suspended;

  -- Parrainage / fondateur : non modifiables côté client
  new.referral_code            := old.referral_code;
  new.referred_by              := old.referred_by;
  new.is_founder               := old.is_founder;
  new.subscription_is_promo    := old.subscription_is_promo;
  new.welcome_claimed          := old.welcome_claimed;
  new.referral_qualified       := old.referral_qualified;
  new.referral_rewards_granted := old.referral_rewards_granted;
  new.reward_days_banked       := old.reward_days_banked;
  new.has_paid_subscription    := old.has_paid_subscription;
  new.referee_discount_used    := old.referee_discount_used;
  return new;
end;
$$;
-- (le trigger protect_tutor_privileged_fields existe déjà et pointe sur cette fonction)
