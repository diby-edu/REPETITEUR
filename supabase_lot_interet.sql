-- ============================================================
-- MonRépétiteur — Additif D : bouton « Intéressé » (répétiteur → parent)
--
-- Un répétiteur vérifié signale son intérêt à un parent qui cherche.
-- → notification au parent (sans jamais dévoiler ses coordonnées),
--   avec un lien vers le PROFIL PUBLIC du répétiteur (pour le recruter).
-- Aucune conversation n'est créée (anti-contournement). 1 intérêt par
-- couple (tuteur, parent) — anti-spam.
--
-- Ajouts uniquement, idempotent.
-- ============================================================

create table if not exists public.tutor_interests (
  id         uuid primary key default uuid_generate_v4(),
  tutor_id   uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique (tutor_id, parent_id)
);
create index if not exists idx_tutor_interests_tutor on public.tutor_interests(tutor_id);

alter table public.tutor_interests enable row level security;
grant select on public.tutor_interests to authenticated;

drop policy if exists "tutor_reads_own_interests" on public.tutor_interests;
create policy "tutor_reads_own_interests" on public.tutor_interests
  for select using (auth.uid() = tutor_id or public.is_admin());

-- RPC : le répétiteur exprime son intérêt (insertion + notif via SECURITY DEFINER)
create or replace function public.express_interest(p_parent uuid)
returns void as $$
declare
  tut public.profiles%rowtype;
  n_inserted int;
begin
  select * into tut from public.profiles where id = auth.uid() and role = 'tutor';
  if tut.id is null then
    raise exception 'NOT_A_TUTOR' using message = 'Réservé aux répétiteurs.';
  end if;

  insert into public.tutor_interests (tutor_id, parent_id)
  values (auth.uid(), p_parent)
  on conflict (tutor_id, parent_id) do nothing;
  get diagnostics n_inserted = row_count;

  -- Notifier le parent uniquement au 1er intérêt (anti-spam)
  if n_inserted > 0 then
    perform public.create_notification(
      p_parent,
      'tutor_interest',
      'Un répétiteur souhaite vous accompagner',
      coalesce(tut.first_name || ' ' || tut.last_name, 'Un répétiteur')
        || ' est intéressé par votre profil. Consultez son profil pour le recruter.',
      '/repetiteur/' || auth.uid()
    );
  end if;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.express_interest(uuid) to authenticated;
