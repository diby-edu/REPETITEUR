-- ============================================================
-- PARRAINAGE — Étape 1 : fondations (config + colonnes + codes)
--   Modèle : 50 fondateurs gratuits « jusqu'au 1er contrat » (+7 j pour
--   s'abonner), parrainage 3 filleuls payants → +1 mois (banké si le
--   parrain est encore gratuit), filleul −50 % sur son 1er mois payant.
-- Idempotent. À lancer dans Supabase > SQL Editor.
-- (Étape 2 = fonctions welcome/conversion/récompense ; 3 = client.)
-- ============================================================

-- 1) Configuration éditable par l'admin -------------------------------
create table if not exists public.referral_config (
  id                   int primary key default 1 check (id = 1),
  welcome_enabled      boolean not null default true,   -- offre fondateur active
  welcome_max_tutors   int     not null default 50,      -- nombre de places fondateur (0 = illimité)
  welcome_grace_days   int     not null default 7,       -- délai pour payer après le 1er contrat
  referral_enabled     boolean not null default true,
  referral_threshold   int     not null default 3,       -- filleuls payants pour 1 récompense
  referral_reward_days int     not null default 30,       -- durée offerte au parrain
  referee_discount_pct int     not null default 50,       -- remise 1er mois payant du filleul
  updated_at           timestamptz default now()
);
insert into public.referral_config (id) values (1) on conflict (id) do nothing;
-- (si la table existait déjà en version précédente, on complète les colonnes)
alter table public.referral_config
  add column if not exists welcome_max_tutors int not null default 50,
  add column if not exists welcome_grace_days int not null default 7;

alter table public.referral_config enable row level security;
drop policy if exists "Config parrainage lisible" on public.referral_config;
create policy "Config parrainage lisible" on public.referral_config
  for select to anon, authenticated using (true);
drop policy if exists "Admin édite la config parrainage" on public.referral_config;
create policy "Admin édite la config parrainage" on public.referral_config
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 2) Colonnes de parrainage / fondateur sur tutors --------------------
alter table public.tutors
  add column if not exists referral_code           text,
  add column if not exists referred_by             uuid references public.profiles(id),
  add column if not exists is_founder              boolean not null default false, -- place fondateur (gratuit jusqu'au 1er contrat)
  add column if not exists subscription_is_promo    boolean not null default false, -- abonnement offert (ne compte pas pour le parrainage)
  add column if not exists welcome_claimed          boolean not null default false,
  add column if not exists referral_qualified       boolean not null default false, -- a payé son 1er vrai mois
  add column if not exists referral_rewards_granted int     not null default 0,      -- récompenses déjà appliquées
  add column if not exists reward_days_banked       int     not null default 0,      -- mois gagnés en réserve (parrain encore gratuit)
  add column if not exists referee_discount_used    boolean not null default false;

-- 3) Code de parrainage : 8 caractères déterministes (id) -------------
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
