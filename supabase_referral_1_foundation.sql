-- ============================================================
-- PARRAINAGE — Étape 1 : fondations (config + colonnes + codes)
--   • referral_config : paramètres pilotables depuis l'admin
--   • tutors : referral_code, referred_by, drapeaux promo/qualif
--   • génération d'un code de parrainage par répétiteur
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- (Étapes 2 = fonctions welcome/récompense, 3 = client : à venir.)
-- ============================================================

-- 1) Table de configuration (une seule ligne, éditable par l'admin) ----
create table if not exists public.referral_config (
  id                   int primary key default 1 check (id = 1),
  welcome_enabled      boolean not null default true,   -- mois offert à la vérification
  welcome_days         int     not null default 30,
  welcome_plan         text    not null default 'standard',
  referral_enabled     boolean not null default true,
  referral_threshold   int     not null default 3,      -- filleuls payants pour 1 récompense
  referral_reward_days int     not null default 30,      -- durée offerte au parrain
  referee_discount_pct int     not null default 50,      -- remise 1er mois payant du filleul
  updated_at           timestamptz default now()
);
insert into public.referral_config (id) values (1) on conflict (id) do nothing;

alter table public.referral_config enable row level security;

drop policy if exists "Config parrainage lisible" on public.referral_config;
create policy "Config parrainage lisible" on public.referral_config
  for select to anon, authenticated using (true);

drop policy if exists "Admin édite la config parrainage" on public.referral_config;
create policy "Admin édite la config parrainage" on public.referral_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Colonnes de parrainage sur tutors --------------------------------
alter table public.tutors
  add column if not exists referral_code           text,
  add column if not exists referred_by             uuid references public.profiles(id),
  add column if not exists subscription_is_promo    boolean not null default false,
  add column if not exists welcome_claimed          boolean not null default false,
  add column if not exists referral_qualified       boolean not null default false, -- a payé un vrai mois → compte pour son parrain
  add column if not exists referral_rewards_granted int     not null default 0,      -- récompenses déjà créditées au parrain
  add column if not exists referee_discount_used    boolean not null default false;

-- 3) Code de parrainage : 8 caractères déterministes (à partir de l'id)
--    Backfill des tuteurs existants + trigger pour les nouveaux.
update public.tutors
  set referral_code = upper(substr(md5(id::text), 1, 8))
  where referral_code is null;

create unique index if not exists idx_tutors_referral_code on public.tutors(referral_code);
create index if not exists idx_tutors_referred_by on public.tutors(referred_by);

create or replace function public.set_referral_code()
returns trigger as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substr(md5(new.id::text), 1, 8));
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_referral_code on public.tutors;
create trigger set_referral_code
  before insert on public.tutors
  for each row execute function public.set_referral_code();
