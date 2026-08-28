-- ============================================================
-- MonRépétiteur — Lot 4 Part B : péage de modération
--
-- Interrupteur admin. Quand ON, une nouvelle demande de recrutement
-- entre en `pending_review` : le répétiteur n'est PAS notifié ; seul
-- l'admin l'est. L'admin voit/édite le message puis LIBÈRE la demande
-- (release_engagement) → le répétiteur est alors notifié et la voit.
--
-- Ajouts uniquement, idempotent.
-- ============================================================

-- 1) Config plateforme (drapeau)
create table if not exists public.platform_config (
  id                      int primary key default 1 check (id = 1),
  moderation_gate_enabled boolean not null default false
);
insert into public.platform_config (id) values (1) on conflict (id) do nothing;

alter table public.platform_config enable row level security;
grant select on public.platform_config to anon, authenticated;
grant update on public.platform_config to authenticated;

drop policy if exists "config_read" on public.platform_config;
create policy "config_read" on public.platform_config for select using (true);
drop policy if exists "config_admin_write" on public.platform_config;
create policy "config_admin_write" on public.platform_config
  for update using (public.is_admin()) with check (public.is_admin());

-- 2) État de modération sur les demandes
alter table public.engagements
  add column if not exists moderation_status text;  -- null = libéré/normal, 'pending_review' = retenu

-- 3) BEFORE INSERT : si le péage est ON, la demande est retenue
create or replace function public.apply_moderation_gate()
returns trigger as $$
declare gate boolean;
begin
  select moderation_gate_enabled into gate from public.platform_config where id = 1;
  if coalesce(gate, false) and new.status = 'pending' then
    new.moderation_status := 'pending_review';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists apply_moderation_gate on public.engagements;
create trigger apply_moderation_gate
  before insert on public.engagements
  for each row execute function public.apply_moderation_gate();

-- 4) Notification à la création : répétiteur SEULEMENT si non retenu ;
--    admin toujours (mention « à valider » si retenu).
create or replace function public.handle_engagement_created()
returns trigger as $$
declare
  p public.profiles%rowtype;
  class_label text;
  who text;
  held boolean := (new.moderation_status = 'pending_review');
  body text;
begin
  select * into p from public.profiles where id = new.parent_id;
  select label into class_label from public.level_packages where level_key = new.level_key;
  who := coalesce(p.first_name || ' ' || p.last_name, 'Un parent');
  body := who || ' souhaite vous recruter'
    || case when class_label is not null then ' en ' || class_label
            when new.subject is not null then ' en ' || new.subject else '' end
    || case when new.child_label is not null then ' pour ' || new.child_label else '' end
    || ' (' || replace(to_char(new.monthly_rate, 'FM999,999,999'), ',', ' ') || ' FCFA/mois).';

  if not held then
    perform public.create_notification(new.tutor_id, 'engagement_proposed',
      'Nouvelle demande de recrutement', body, '/tableau-de-bord/repetiteur');
  end if;

  insert into public.notifications (user_id, type, title, message, link)
  select a.id, 'engagement_request',
         case when held then 'Demande à valider (modération)' else 'Nouvelle demande de recrutement' end,
         who || ' a fait une demande de recrutement'
           || case when class_label is not null then ' (' || class_label || ')' else '' end
           || case when held then ' — à valider avant transmission.' else '.' end,
         '/admin?tab=Conversations'
  from public.profiles a
  where a.role = 'admin';

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) Libération par l'admin (édite éventuellement le message, notifie le répétiteur)
create or replace function public.release_engagement(p_id uuid, p_notes text default null)
returns void as $$
declare
  eng public.engagements%rowtype;
  p   public.profiles%rowtype;
  class_label text;
  who text;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using message = 'Réservé à l''admin.';
  end if;

  select * into eng from public.engagements where id = p_id;
  if eng.id is null or eng.moderation_status is distinct from 'pending_review' then return; end if;

  update public.engagements
    set moderation_status = null,
        notes = coalesce(p_notes, notes)
    where id = p_id;

  select * into p from public.profiles where id = eng.parent_id;
  select label into class_label from public.level_packages where level_key = eng.level_key;
  who := coalesce(p.first_name || ' ' || p.last_name, 'Un parent');

  perform public.create_notification(
    eng.tutor_id, 'engagement_proposed', 'Nouvelle demande de recrutement',
    who || ' souhaite vous recruter'
      || case when class_label is not null then ' en ' || class_label
              when eng.subject is not null then ' en ' || eng.subject else '' end
      || case when eng.child_label is not null then ' pour ' || eng.child_label else '' end
      || ' (' || replace(to_char(eng.monthly_rate, 'FM999,999,999'), ',', ' ') || ' FCFA/mois).',
    '/tableau-de-bord/repetiteur'
  );
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.release_engagement(uuid, text) to authenticated;
