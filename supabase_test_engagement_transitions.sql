-- ============================================================
-- TEST (non destructif) du durcissement des transitions d'engagement.
-- À lancer APRÈS supabase_fix_engagement_transitions.sql.
--
-- Principe : engagement JETABLE + impersonation via request.jwt.claims,
-- chaque cas RAISE EXCEPTION s'il dévie, puis ROLLBACK (rien n'est
-- persisté). Résultat attendu : la ligne finale "TOUS LES 8 TESTS
-- PASSENT". Une erreur "TEST N ECHEC" pointe le cas fautif.
-- (L'éditeur Supabase n'affiche pas les RAISE NOTICE → on s'appuie
--  sur des exceptions + un SELECT final.)
-- ============================================================
begin;
do $$
declare
  v_parent uuid := 'd51247c2-b6b8-41cf-8dc4-bf3c272c166e'; -- SIZE KOFFI (parent)
  v_tutor  uuid := '36efd7f2-afc5-4f67-a381-d2e521eeaac8'; -- Seydou (répétiteur)
  v_eng uuid; v_sd int; v_end date; v_status text; ok boolean;
begin
  perform set_config('app.system_task','1',true);
  insert into public.engagements(parent_id,tutor_id,subject,monthly_rate,start_date,end_date,status)
  values (v_parent,v_tutor,'TEST-DURCISSEMENT',1000,current_date,current_date+30,'pending')
  returning id into v_eng;
  perform set_config('app.system_task','',true);

  -- 1) parent pending->active : doit être bloqué
  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  ok := false;
  begin update public.engagements set status='active' where id=v_eng; exception when others then ok:=true; end;
  if not ok then raise exception 'TEST 1 ECHEC: parent pending->active NON bloqué'; end if;

  -- 2) parent change end_date : doit être bloqué
  ok := false;
  begin update public.engagements set end_date=current_date+365 where id=v_eng; exception when others then ok:=true; end;
  if not ok then raise exception 'TEST 2 ECHEC: parent end_date NON bloqué'; end if;

  -- 3) tuteur sessions_done : doit être ignoré
  perform set_config('request.jwt.claims', json_build_object('sub',v_tutor,'role','authenticated')::text, true);
  update public.engagements set sessions_done=8 where id=v_eng;
  select sessions_done into v_sd from public.engagements where id=v_eng;
  if v_sd <> 0 then raise exception 'TEST 3 ECHEC: tuteur a écrit sessions_done=%', v_sd; end if;

  -- 4) tuteur accepte pending->active : doit passer
  begin update public.engagements set status='active' where id=v_eng;
  exception when others then raise exception 'TEST 4 ECHEC: acceptation tuteur bloquée: %', sqlerrm; end;
  select status into v_status from public.engagements where id=v_eng;
  if v_status <> 'active' then raise exception 'TEST 4 ECHEC: status=% apres accept', v_status; end if;

  -- 8) tuteur active->pending : doit être bloqué
  ok := false;
  begin update public.engagements set status='pending' where id=v_eng; exception when others then ok:=true; end;
  if not ok then raise exception 'TEST 8 ECHEC: active->pending NON bloqué'; end if;

  -- 5) parent valide sessions_done=1 : doit passer
  perform set_config('request.jwt.claims', json_build_object('sub',v_parent,'role','authenticated')::text, true);
  update public.engagements set sessions_done=1 where id=v_eng;
  select sessions_done into v_sd from public.engagements where id=v_eng;
  if v_sd <> 1 then raise exception 'TEST 5 ECHEC: parent sessions_done=% (attendu 1)', v_sd; end if;

  -- 6) parent résilie active->ended : doit passer
  begin update public.engagements set status='ended' where id=v_eng;
  exception when others then raise exception 'TEST 6 ECHEC: résiliation parent bloquée: %', sqlerrm; end;
  select status into v_status from public.engagements where id=v_eng;
  if v_status <> 'ended' then raise exception 'TEST 6 ECHEC: status=%', v_status; end if;

  -- 7) système end_date+30 : doit passer
  perform set_config('request.jwt.claims','',true);
  perform set_config('app.system_task','1',true);
  update public.engagements set status='active', end_date=current_date+30 where id=v_eng;
  update public.engagements set end_date=end_date+30 where id=v_eng;
  select end_date into v_end from public.engagements where id=v_eng;
  perform set_config('app.system_task','',true);
  if v_end <> current_date+60 then raise exception 'TEST 7 ECHEC: end_date=% (attendu %)', v_end, current_date+60; end if;
end $$;
rollback;
select 'TOUS LES 8 TESTS PASSENT (aucune donnee reelle modifiee)' as resultat;
