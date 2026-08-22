-- ============================================================
-- MonRépétiteur — REFONTE Lot 1 : Fondations "contrats mensuels"
--   - level_packages : forfaits imposés par niveau (éditables admin)
--   - tutor_offers   : offre du répétiteur (tarif mensuel par classe)
--   - engagements    : colonnes ajoutées pour le contrat mensuel
--
-- Sans risque pour l'existant (ajouts uniquement). Idempotent.
-- À exécuter dans Supabase > SQL Editor > New query > Run.
-- ============================================================

-- ── 1) Référentiel des forfaits (imposés, modifiables par l'admin) ──
create table if not exists public.level_packages (
  level_key         text primary key,
  label             text not null,
  category          text not null check (category in ('primaire','college','lycee')),
  sessions_per_week int  not null,
  hours_per_session numeric(4,2) not null,
  hours_per_month   numeric(5,2) not null,
  has_subjects      boolean not null default true,
  sort_order        int not null default 0
);

-- Seed (validé) : Primaire 12h · 6e-4e 16h · 3e/Tle 24h · 2nde/1ère 16h
insert into public.level_packages (level_key, label, category, sessions_per_week, hours_per_session, hours_per_month, has_subjects, sort_order) values
  ('primaire', 'Primaire',   'primaire', 2, 1.5, 12, false, 1),
  ('6e',       '6ᵉ',         'college',  2, 2.0, 16, true,  2),
  ('5e',       '5ᵉ',         'college',  2, 2.0, 16, true,  3),
  ('4e',       '4ᵉ',         'college',  2, 2.0, 16, true,  4),
  ('3e',       '3ᵉ',         'college',  3, 2.0, 24, true,  5),
  ('2nde',     '2ⁿᵈᵉ',       'lycee',    2, 2.0, 16, true,  6),
  ('1ere',     '1ʳᵉ',        'lycee',    2, 2.0, 16, true,  7),
  ('tle',      'Terminale',  'lycee',    3, 2.0, 24, true,  8)
on conflict (level_key) do nothing;

alter table public.level_packages enable row level security;
grant select on public.level_packages to anon, authenticated;
grant insert, update, delete on public.level_packages to authenticated;

drop policy if exists "Forfaits visibles par tous" on public.level_packages;
create policy "Forfaits visibles par tous" on public.level_packages
  for select using (true);

drop policy if exists "Admin gère les forfaits" on public.level_packages;
create policy "Admin gère les forfaits" on public.level_packages
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 2) Offre du répétiteur : un tarif mensuel par classe ──
create table if not exists public.tutor_offers (
  id            uuid primary key default uuid_generate_v4(),
  tutor_id      uuid not null references public.profiles(id) on delete cascade,
  level_key     text not null references public.level_packages(level_key),
  subjects      text[] not null default '{}',
  monthly_price int not null check (monthly_price >= 0),
  active        boolean not null default true,
  created_at    timestamptz default now(),
  unique (tutor_id, level_key)
);
create index if not exists idx_tutor_offers_tutor on public.tutor_offers(tutor_id);
create index if not exists idx_tutor_offers_level on public.tutor_offers(level_key);

alter table public.tutor_offers enable row level security;
grant select on public.tutor_offers to anon, authenticated;
grant insert, update, delete on public.tutor_offers to authenticated;

-- Offres visibles par tous (vitrine du répétiteur, pas de donnée sensible)
drop policy if exists "Offres visibles par tous" on public.tutor_offers;
create policy "Offres visibles par tous" on public.tutor_offers
  for select using (true);

-- Le répétiteur gère ses propres offres ; l'admin peut tout.
drop policy if exists "Répétiteur gère ses offres" on public.tutor_offers;
create policy "Répétiteur gère ses offres" on public.tutor_offers
  for insert with check (auth.uid() = tutor_id or public.is_admin());
drop policy if exists "Répétiteur modifie ses offres" on public.tutor_offers;
create policy "Répétiteur modifie ses offres" on public.tutor_offers
  for update using (auth.uid() = tutor_id or public.is_admin())
  with check (auth.uid() = tutor_id or public.is_admin());
drop policy if exists "Répétiteur supprime ses offres" on public.tutor_offers;
create policy "Répétiteur supprime ses offres" on public.tutor_offers
  for delete using (auth.uid() = tutor_id or public.is_admin());

-- ── 3) Contrat mensuel : colonnes ajoutées à engagements ──
alter table public.engagements
  add column if not exists level_key       text references public.level_packages(level_key),
  add column if not exists subjects         text[] default '{}',
  add column if not exists agreed_schedule  text,
  add column if not exists ended_by         text,
  add column if not exists ended_at         timestamptz;

-- ── Vérifications rapides ──
-- select * from public.level_packages order by sort_order;
-- select count(*) from public.tutor_offers;
