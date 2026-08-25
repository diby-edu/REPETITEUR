-- ============================================================
-- TEST (non destructif) des fonctions de parrainage (étape 2).
-- À lancer APRÈS supabase_referral_2_functions.sql.
-- Impersonation + rollback : aucune donnée réelle modifiée.
-- Résultat attendu : la ligne "TOUS LES TESTS PARRAINAGE PASSENT".
-- ============================================================
begin;
-- FK profiles.id -> auth.users : retirée le temps du test (rétablie au rollback)
alter table public.profiles drop constraint if exists profiles_id_fkey;
do $$
declare
  R uuid := gen_random_uuid(); -- parrain
  F1 uuid := gen_random_uuid(); F2 uuid := gen_random_uuid(); F3 uuid := gen_random_uuid(); -- filleuls
  Y uuid := gen_random_uuid(); -- au-delà du cap
  G uuid := gen_random_uuid(); -- fondateur pour la conversion
  P uuid := gen_random_uuid(); -- parent
  v_eng uuid; v_end date; v_banked int; v_granted int;
  b_founder boolean; b_qual boolean; b_paid boolean; b_disc boolean;
begin
  -- Config de test : cap 2 fondateurs, seuil 3, +30 j
  update public.referral_config set
    welcome_enabled=true, welcome_max_tutors=2, welcome_grace_days=7,
    referral_enabled=true, referral_threshold=3, referral_reward_days=30, referee_discount_pct=50
  where id=1;

  -- Profils + tuteurs jetables
  insert into public.profiles(id,role,first_name,last_name,email) values
    (R,'tutor','Ref','Parrain','r@t'),(F1,'tutor','Fil','Un','f1@t'),
    (F2,'tutor','Fil','Deux','f2@t'),(F3,'tutor','Fil','Trois','f3@t'),
    (Y,'tutor','Yann','Cap','y@t'),(G,'tutor','Gonzo','Fond','g@t'),
    (P,'parent','Pat','Rent','p@t');
  insert into public.tutors(id) values (R),(F1),(F2),(F3),(Y),(G);

  -- ===== A. Place fondateur à la vérification (cap = 2) =====
  -- (drapeau système = on simule l'admin ; referred_by et la vérif sont des champs protégés)
  perform set_config('app.system_task','1',true);
  update public.tutors set referred_by=R where id in (F1,F2,F3);
  update public.tutors set verification_status='verified' where id=R;  -- fondateur 1
  update public.tutors set verification_status='verified' where id=G;  -- fondateur 2
  update public.tutors set verification_status='verified' where id in (F1,F2,F3,Y); -- cap atteint
  perform set_config('app.system_task','',true);
  select is_founder into b_founder from public.tutors where id=R;
  if not b_founder then raise exception 'A1 ECHEC: R devrait être fondateur'; end if;
  select is_founder, subscription_is_promo, subscription_end into b_founder, b_qual, v_end from public.tutors where id=G;
  if not (b_founder and b_qual and v_end is null) then raise exception 'A2 ECHEC: G fondateur promo sans échéance attendu'; end if;
  select is_founder into b_founder from public.tutors where id=Y;
  if b_founder then raise exception 'A3 ECHEC: Y ne devrait PAS être fondateur (cap 2)'; end if;

  -- ===== B. Conversion fondateur : 1er contrat actif → +7 j =====
  insert into public.engagements(parent_id,tutor_id,subject,monthly_rate,start_date,end_date,status)
    values (P,G,'TEST',1000,current_date,current_date+30,'pending') returning id into v_eng;
  perform set_config('app.system_task','1',true);
  update public.engagements set status='active' where id=v_eng;
  perform set_config('app.system_task','',true);
  select subscription_end into v_end from public.tutors where id=G;
  if v_end <> current_date + 7 then raise exception 'B ECHEC: G échéance attendue +7j, obtenu %', v_end; end if;

  -- ===== C. Qualification + crédit banké du parrain =====
  perform set_config('app.system_task','1',true);  -- contexte admin/webhook pour les activations
  perform public.activate_paid_subscription(F1,'standard',1);
  perform public.activate_paid_subscription(F2,'standard',1);
  select reward_days_banked into v_banked from public.tutors where id=R;
  if v_banked <> 0 then raise exception 'C1 ECHEC: pas de récompense avant 3 filleuls (banked=%)', v_banked; end if;
  perform public.activate_paid_subscription(F3,'standard',1);
  select reward_days_banked, referral_rewards_granted into v_banked, v_granted from public.tutors where id=R;
  if v_banked <> 30 then raise exception 'C2 ECHEC: banked attendu 30, obtenu %', v_banked; end if;
  if v_granted <> 1 then raise exception 'C3 ECHEC: rewards_granted attendu 1, obtenu %', v_granted; end if;
  select referral_qualified into b_qual from public.tutors where id=F1;
  if not b_qual then raise exception 'C4 ECHEC: F1 devrait être qualifié'; end if;

  -- ===== D. Encaissement des mois banké au 1er paiement du parrain =====
  perform public.activate_paid_subscription(R,'standard',1);
  select subscription_end, has_paid_subscription, reward_days_banked into v_end, b_paid, v_banked from public.tutors where id=R;
  if v_end <> current_date + 60 then raise exception 'D1 ECHEC: R échéance attendue +60j (30 payé +30 banké), obtenu %', v_end; end if;
  if not b_paid then raise exception 'D2 ECHEC: R has_paid devrait être true'; end if;
  if v_banked <> 0 then raise exception 'D3 ECHEC: R banked devrait être 0'; end if;

  -- ===== E. Remise filleul marquée au 1er paiement =====
  select referee_discount_used into b_disc from public.tutors where id=F1;
  if not b_disc then raise exception 'E ECHEC: F1 referee_discount_used devrait être true'; end if;

  -- ===== F. Anti-fraude : un tuteur ne peut pas se qualifier lui-même =====
  -- (les fonctions ont laissé le drapeau système actif → on le retire pour tester la protection)
  perform set_config('app.system_task','',true);
  perform set_config('request.jwt.claims', json_build_object('sub', Y::text, 'role','authenticated')::text, true);
  update public.tutors set referral_qualified=true, reward_days_banked=999, is_founder=true, has_paid_subscription=true where id=Y;
  perform set_config('request.jwt.claims','',true);
  select referral_qualified, reward_days_banked, is_founder, has_paid_subscription
    into b_qual, v_banked, b_founder, b_paid from public.tutors where id=Y;
  if b_qual or v_banked<>0 or b_founder or b_paid then
    raise exception 'F ECHEC: Y a pu tricher (qual=% banked=% founder=% paid=%)', b_qual, v_banked, b_founder, b_paid;
  end if;
end $$;
rollback;
select 'TOUS LES TESTS PARRAINAGE PASSENT (aucune donnee reelle modifiee)' as resultat;
