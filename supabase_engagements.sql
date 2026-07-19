-- ============================================================
-- MonRépétiteur — Système d'engagements (contrats mensuels)
-- Remplace la logique de bookings individuels
-- Tables : engagements, sessions, payments
-- À exécuter dans : Supabase → SQL Editor → Run
-- ============================================================

-- ============================================================
-- TABLE: engagements (le contrat mensuel parent ↔ répétiteur)
-- ============================================================
create table if not exists public.engagements (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  tutor_id   uuid not null references public.profiles(id) on delete cascade,

  -- Détails du contrat
  subject      text    not null,
  monthly_rate integer not null check (monthly_rate > 0),
  notes        text,

  -- Planning : [{day:'lundi', time:'14:00', duration:120}, ...]
  -- duration en minutes, ex: 120 = 2h
  schedule jsonb not null default '[]'::jsonb,

  -- Modification de planning en cours (proposée par l'une des parties)
  proposed_schedule    jsonb,
  schedule_proposed_by text check (schedule_proposed_by in ('parent', 'tutor')),
  schedule_status      text check (schedule_status in ('pending', 'accepted', 'rejected')),

  -- Cycle de vie du contrat
  start_date date not null,
  end_date   date not null, -- start_date + 30 jours (prolongé à chaque renouvellement)
  status     text not null default 'pending'
             check (status in ('pending', 'active', 'ended')),
  -- pending : parent a proposé, répétiteur n'a pas encore accepté
  -- active  : répétiteur a accepté, séances en cours
  -- ended   : contrat terminé (non renouvelé ou résilié)

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TABLE: sessions (occurrences individuelles de séances)
-- Générées automatiquement depuis le planning de l'engagement
-- ============================================================
create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,

  -- Créneau planifié
  scheduled_date   date    not null,
  scheduled_time   time    not null,
  duration_minutes integer not null default 120,

  -- Rapport du parent (null = séance future ou parent n'a pas encore renseigné)
  parent_report text check (parent_report in ('on_time', 'late', 'absent')),
  -- on_time : répétiteur venu à l'heure    ✓
  -- late    : répétiteur venu en retard    ⏰
  -- absent  : répétiteur n'est pas venu    ✗

  late_minutes integer check (late_minutes > 0), -- renseigné si parent_report = 'late'
  reported_at  timestamptz,                       -- quand le parent a coché

  -- Note optionnelle laissée en même temps que le rapport de présence
  session_rating  integer check (session_rating between 1 and 5),
  session_comment text,

  created_at timestamptz default now(),

  -- Unicité : une seule séance par engagement à un créneau donné
  unique (engagement_id, scheduled_date, scheduled_time)
);

-- ============================================================
-- TABLE: payments (paiement mensuel hors-ligne — double confirmation)
-- Créé à la fin de chaque mois de contrat
-- ============================================================
create table if not exists public.payments (
  id            uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.engagements(id) on delete cascade,

  -- Période concernée
  period_start date    not null, -- début du mois de contrat payé
  period_end   date    not null, -- fin du mois de contrat payé
  amount       integer not null check (amount > 0),

  -- Mode de paiement (hors-ligne)
  payment_method text check (payment_method in ('cash', 'orange_money', 'wave', 'mtn_money')),

  -- Étape 1 : le parent déclare qu'il a payé + sa décision de continuer
  parent_wants_continue boolean,    -- true = veut continuer, false = arrête
  parent_declared_at    timestamptz,

  -- Étape 2 : le répétiteur confirme réception + sa décision de continuer
  tutor_wants_continue boolean,
  tutor_confirmed_at   timestamptz,

  -- Statut du paiement
  status text not null default 'pending'
    check (status in (
      'pending',          -- fin de mois approche, paiement pas encore déclaré
      'parent_declared',  -- parent a déclaré avoir payé
      'confirmed'         -- répétiteur a confirmé réception
    )),

  created_at timestamptz default now()
);

-- ============================================================
-- INDEX (performances)
-- ============================================================
create index if not exists idx_engagements_parent on public.engagements(parent_id);
create index if not exists idx_engagements_tutor  on public.engagements(tutor_id);
create index if not exists idx_engagements_status on public.engagements(status);
create index if not exists idx_engagements_end    on public.engagements(end_date);
create index if not exists idx_sessions_engagement on public.sessions(engagement_id);
create index if not exists idx_sessions_date       on public.sessions(scheduled_date);
create index if not exists idx_payments_engagement on public.payments(engagement_id);
create index if not exists idx_payments_status     on public.payments(status);

-- ============================================================
-- RLS
-- ============================================================
alter table public.engagements enable row level security;
alter table public.sessions    enable row level security;
alter table public.payments    enable row level security;

-- ── ENGAGEMENTS ─────────────────────────────────────────────

-- Voir ses propres engagements (parent ou répétiteur)
create policy "Voir ses engagements" on public.engagements for select
  using (auth.uid() = parent_id or auth.uid() = tutor_id);

-- Admin voit tout
create policy "Admin voit tous les engagements" on public.engagements for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Parent crée un engagement
create policy "Parent crée un engagement" on public.engagements for insert
  with check (auth.uid() = parent_id);

-- Parent ou répétiteur peut modifier (accepter, modifier planning, statut)
create policy "Modifier son engagement" on public.engagements for update
  using (auth.uid() = parent_id or auth.uid() = tutor_id);

-- ── SESSIONS ────────────────────────────────────────────────

-- Admin voit toutes les séances
create policy "Admin voit toutes les séances" on public.sessions for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Voir les séances de ses engagements
create policy "Voir ses séances" on public.sessions for select
  using (exists (
    select 1 from public.engagements e
    where e.id = sessions.engagement_id
    and (e.parent_id = auth.uid() or e.tutor_id = auth.uid())
  ));

-- Insertion par trigger (security definer) + par les parties
create policy "Insérer une séance" on public.sessions for insert
  with check (exists (
    select 1 from public.engagements e
    where e.id = sessions.engagement_id
    and (e.parent_id = auth.uid() or e.tutor_id = auth.uid())
  ));

-- Seul le parent peut cocher (parent_report)
create policy "Parent renseigne le rapport" on public.sessions for update
  using (exists (
    select 1 from public.engagements e
    where e.id = sessions.engagement_id and e.parent_id = auth.uid()
  ));

-- ── PAYMENTS ────────────────────────────────────────────────

-- Admin voit tous les paiements
create policy "Admin voit tous les paiements" on public.payments for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Voir les paiements de ses engagements
create policy "Voir ses paiements" on public.payments for select
  using (exists (
    select 1 from public.engagements e
    where e.id = payments.engagement_id
    and (e.parent_id = auth.uid() or e.tutor_id = auth.uid())
  ));

-- Parent déclare le paiement (INSERT)
create policy "Parent déclare un paiement" on public.payments for insert
  with check (exists (
    select 1 from public.engagements e
    where e.id = payments.engagement_id and e.parent_id = auth.uid()
  ));

-- Parent ou répétiteur met à jour (parent déclare, répétiteur confirme)
create policy "Mettre à jour un paiement" on public.payments for update
  using (exists (
    select 1 from public.engagements e
    where e.id = payments.engagement_id
    and (e.parent_id = auth.uid() or e.tutor_id = auth.uid())
  ));

-- ============================================================
-- FONCTION: générer les séances d'un engagement sur une période
-- Appelée automatiquement à l'activation et au renouvellement
-- ============================================================
create or replace function public.generate_sessions(
  p_engagement_id uuid,
  p_from date,
  p_to   date
) returns void as $$
declare
  eng     public.engagements%rowtype;
  slot    jsonb;
  cur_d   date;
  dow_num integer;
begin
  select * into eng from public.engagements where id = p_engagement_id;

  -- Pour chaque créneau du planning
  for slot in select * from jsonb_array_elements(eng.schedule) loop
    -- Convertir le nom du jour en numéro (DOW PostgreSQL : 0=dim … 6=sam)
    dow_num := case slot->>'day'
      when 'lundi'    then 1
      when 'mardi'    then 2
      when 'mercredi' then 3
      when 'jeudi'    then 4
      when 'vendredi' then 5
      when 'samedi'   then 6
      when 'dimanche' then 0
    end;

    -- Parcourir chaque jour de la période
    cur_d := p_from;
    while cur_d <= p_to loop
      if extract(dow from cur_d) = dow_num then
        insert into public.sessions (
          engagement_id, scheduled_date, scheduled_time, duration_minutes
        ) values (
          p_engagement_id,
          cur_d,
          (slot->>'time')::time,
          coalesce((slot->>'duration')::integer, 120)
        )
        on conflict (engagement_id, scheduled_date, scheduled_time) do nothing;
      end if;
      cur_d := cur_d + 1;
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- FONCTION: vérifier les engagements qui expirent dans 3 jours
-- Appelée côté client au login (et plus tard via cron)
-- ============================================================
create or replace function public.check_expiring_engagements() returns void as $$
declare
  eng public.engagements%rowtype;
  t   public.profiles%rowtype;
begin
  for eng in
    select * from public.engagements
    where status = 'active'
    and end_date = current_date + 3
    -- Ne pas envoyer si une notification J-3 existe déjà aujourd'hui
    and not exists (
      select 1 from public.notifications n
      where n.user_id = eng.parent_id
      and n.type = 'engagement_expiring'
      and n.created_at::date = current_date
    )
  loop
    select * into t from public.profiles where id = eng.tutor_id;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      eng.parent_id,
      'engagement_expiring',
      'Règlement à prévoir dans 3 jours',
      'Votre contrat avec ' || t.first_name || ' ' || t.last_name ||
      ' (' || eng.subject || ') se termine le ' ||
      to_char(eng.end_date, 'DD/MM/YYYY') ||
      '. Préparez le règlement de ' ||
      to_char(eng.monthly_rate, 'FM999G999') || ' FCFA.',
      '/tableau-de-bord/parent'
    );
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- FONCTION: marquer comme 'ended' les engagements expirés
-- sans paiement confirmé — appelée côté client au login
-- ============================================================
create or replace function public.expire_ended_engagements() returns void as $$
begin
  update public.engagements
  set status = 'ended', updated_at = now()
  where status = 'active'
  and end_date < current_date
  -- Pas de paiement confirmé avec volonté de continuer des deux côtés
  and not exists (
    select 1 from public.payments p
    where p.engagement_id = engagements.id
    and p.period_end = engagements.end_date
    and p.status = 'confirmed'
    and p.parent_wants_continue = true
    and p.tutor_wants_continue  = true
  );
end;
$$ language plpgsql security definer;

-- ============================================================
-- TRIGGER 1: engagement créé → notifier le répétiteur
-- ============================================================
create or replace function public.handle_engagement_created()
returns trigger as $$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = new.parent_id;

  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.tutor_id,
    'engagement_proposed',
    'Nouveau contrat proposé',
    p.first_name || ' ' || p.last_name ||
    ' vous propose un contrat de répétition en ' || new.subject ||
    ' (' || to_char(new.monthly_rate, 'FM999G999') || ' FCFA/mois).',
    '/tableau-de-bord/repetiteur'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_engagement_created
  after insert on public.engagements
  for each row execute function public.handle_engagement_created();

-- ============================================================
-- TRIGGER 2: changement de statut de l'engagement
--   pending → active  : génère les séances + notifie le parent
--   active  → ended   : notifie les deux parties
--   end_date prolongé : génère les séances du nouveau mois
-- ============================================================
create or replace function public.handle_engagement_updated()
returns trigger as $$
declare
  p public.profiles%rowtype;
  t public.profiles%rowtype;
begin
  select * into p from public.profiles where id = new.parent_id;
  select * into t from public.profiles where id = new.tutor_id;

  -- Activation (pending → active) : générer les séances du premier mois
  if new.status = 'active' and old.status = 'pending' then
    perform public.generate_sessions(new.id, new.start_date, new.end_date);

    insert into public.notifications (user_id, type, title, message, link)
    values (
      new.parent_id,
      'engagement_accepted',
      'Contrat accepté !',
      t.first_name || ' ' || t.last_name ||
      ' a accepté votre contrat en ' || new.subject ||
      '. Les séances sont planifiées.',
      '/tableau-de-bord/parent'
    );
  end if;

  -- Renouvellement (end_date prolongé) : générer les séances du nouveau mois
  if new.status = 'active' and new.end_date > old.end_date then
    perform public.generate_sessions(new.id, old.end_date + 1, new.end_date);
  end if;

  -- Résiliation (active → ended) : notifier les deux parties
  if new.status = 'ended' and old.status = 'active' then
    insert into public.notifications (user_id, type, title, message, link) values
    (
      new.parent_id,
      'engagement_ended',
      'Contrat terminé',
      'Votre contrat avec ' || t.first_name || ' ' || t.last_name ||
      ' (' || new.subject || ') est maintenant terminé.',
      '/tableau-de-bord/parent'
    ),
    (
      new.tutor_id,
      'engagement_ended',
      'Contrat terminé',
      'Votre contrat avec ' || p.first_name || ' ' || p.last_name ||
      ' (' || new.subject || ') est maintenant terminé.',
      '/tableau-de-bord/repetiteur'
    );
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer;

create trigger on_engagement_updated
  before update on public.engagements
  for each row execute function public.handle_engagement_updated();

-- ============================================================
-- TRIGGER 3: parent déclare le paiement → notifier le répétiteur
-- ============================================================
create or replace function public.handle_payment_declared()
returns trigger as $$
declare
  eng public.engagements%rowtype;
  p   public.profiles%rowtype;
  method_label text;
begin
  if new.status = 'parent_declared' and old.status = 'pending' then
    select * into eng from public.engagements where id = new.engagement_id;
    select * into p   from public.profiles    where id = eng.parent_id;

    method_label := case new.payment_method
      when 'cash'         then 'Cash'
      when 'orange_money' then 'Orange Money'
      when 'wave'         then 'Wave'
      when 'mtn_money'    then 'MTN Money'
      else 'hors ligne'
    end;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      eng.tutor_id,
      'payment_declared',
      'Paiement déclaré — action requise',
      p.first_name || ' ' || p.last_name ||
      ' a déclaré avoir payé ' ||
      to_char(new.amount, 'FM999G999') || ' FCFA (' || method_label || '). ' ||
      case when new.parent_wants_continue
        then 'Souhaite continuer le mois prochain.'
        else 'Ne souhaite pas renouveler le contrat.'
      end,
      '/tableau-de-bord/repetiteur'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_payment_declared
  after update on public.payments
  for each row execute function public.handle_payment_declared();

-- ============================================================
-- TRIGGER 4: répétiteur confirme → renouveler ou terminer
-- ============================================================
create or replace function public.handle_payment_confirmed()
returns trigger as $$
declare
  eng public.engagements%rowtype;
  t   public.profiles%rowtype;
begin
  if new.status = 'confirmed' and old.status = 'parent_declared' then
    select * into eng from public.engagements where id = new.engagement_id;
    select * into t   from public.profiles    where id = eng.tutor_id;

    if new.parent_wants_continue and new.tutor_wants_continue then
      -- Les deux veulent continuer → prolonger de 30 jours
      update public.engagements
      set end_date = end_date + 30, updated_at = now()
      where id = new.engagement_id;
      -- (le trigger on_engagement_updated génèrera les nouvelles séances)

      insert into public.notifications (user_id, type, title, message, link)
      values (
        eng.parent_id,
        'payment_confirmed',
        'Paiement confirmé — Contrat renouvelé',
        t.first_name || ' ' || t.last_name ||
        ' a confirmé le paiement. Votre contrat est renouvelé pour un mois supplémentaire.',
        '/tableau-de-bord/parent'
      );

    else
      -- L'un ou l'autre ne veut pas continuer → terminer le contrat
      update public.engagements
      set status = 'ended', updated_at = now()
      where id = new.engagement_id;

      insert into public.notifications (user_id, type, title, message, link)
      values (
        eng.parent_id,
        'payment_confirmed',
        'Paiement confirmé — Contrat terminé',
        t.first_name || ' ' || t.last_name ||
        ' a confirmé le paiement. Le contrat prend fin.',
        '/tableau-de-bord/parent'
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_payment_confirmed
  after update on public.payments
  for each row execute function public.handle_payment_confirmed();

-- ============================================================
-- TRIGGER 5: modification de planning → notifier l'autre partie
-- ============================================================
create or replace function public.handle_schedule_proposed()
returns trigger as $$
declare
  proposer public.profiles%rowtype;
  recipient_id uuid;
  dashboard    text;
begin
  if new.schedule_status = 'pending'
     and (old.schedule_status is null or old.schedule_status <> 'pending') then

    -- Qui a proposé et qui doit être notifié ?
    if new.schedule_proposed_by = 'parent' then
      select * into proposer from public.profiles where id = new.parent_id;
      recipient_id := new.tutor_id;
      dashboard    := '/tableau-de-bord/repetiteur';
    else
      select * into proposer from public.profiles where id = new.tutor_id;
      recipient_id := new.parent_id;
      dashboard    := '/tableau-de-bord/parent';
    end if;

    insert into public.notifications (user_id, type, title, message, link)
    values (
      recipient_id,
      'schedule_proposed',
      'Modification de planning demandée',
      proposer.first_name || ' ' || proposer.last_name ||
      ' demande de modifier le planning du contrat ' || new.subject || '.',
      dashboard
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_schedule_proposed
  after update on public.engagements
  for each row execute function public.handle_schedule_proposed();

-- ============================================================
-- VUE: note moyenne par répétiteur (calculée depuis les séances)
-- Utilisée pour afficher les étoiles sur le profil répétiteur
-- ============================================================
create or replace view public.tutor_ratings as
select
  e.tutor_id,
  count(s.id)                                 as total_sessions_rated,
  round(avg(s.session_rating)::numeric, 1)    as average_rating,
  count(s.id) filter (where s.session_rating = 5) as stars_5,
  count(s.id) filter (where s.session_rating = 4) as stars_4,
  count(s.id) filter (where s.session_rating = 3) as stars_3,
  count(s.id) filter (where s.session_rating = 2) as stars_2,
  count(s.id) filter (where s.session_rating = 1) as stars_1
from public.sessions s
join public.engagements e on e.id = s.engagement_id
where s.session_rating is not null
group by e.tutor_id;

-- ============================================================
-- REALTIME (suivi temps réel des engagements et séances)
-- ============================================================
alter publication supabase_realtime add table public.engagements;
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.payments;

-- ============================================================
-- VÉRIFICATION FINALE
-- ============================================================
select
  'engagements' as table_name, count(*) as rows from public.engagements
union all
select 'sessions', count(*) from public.sessions
union all
select 'payments', count(*) from public.payments;
