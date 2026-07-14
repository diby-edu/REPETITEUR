-- ============================================================
-- MonRépétiteur — Schéma Supabase complet
-- Coller dans SQL Editor > New query > Run
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: profiles (commune tuteurs + parents + admin)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('tutor', 'parent', 'admin')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  city text,
  quartier text,
  avatar_color text default '#E87722',
  join_date date default current_date,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: tutors (données spécifiques aux répétiteurs)
-- ============================================================
create table public.tutors (
  id uuid references public.profiles(id) on delete cascade primary key,
  bio text,
  subjects text[] default '{}',
  levels text[] default '{}',
  monthly_rate integer default 0,
  modalities text[] default '{}',
  availability jsonb default '{}',
  verification_status text default 'pending' check (verification_status in ('pending', 'verified', 'rejected')),
  rejection_reason text,
  documents jsonb default '{}',
  subscription_plan text default 'gratuit' check (subscription_plan in ('gratuit', 'standard', 'premium')),
  subscription_start date,
  subscription_end date,
  subscription_status text default 'active' check (subscription_status in ('active', 'expired')),
  rating numeric(3,1) default 0,
  review_count integer default 0,
  session_count integer default 0,
  profile_views integer default 0,
  monthly_requests integer default 0,
  is_active boolean default false,
  suspended boolean default false
);

-- ============================================================
-- TABLE: conversations
-- ============================================================
create table public.conversations (
  id uuid primary key default uuid_generate_v4(),
  participant_1 uuid references public.profiles(id) on delete cascade not null,
  participant_2 uuid references public.profiles(id) on delete cascade not null,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender uuid,
  unread_count_1 integer default 0,
  unread_count_2 integer default 0,
  created_at timestamptz default now(),
  unique(participant_1, participant_2)
);

-- ============================================================
-- TABLE: messages
-- ============================================================
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: bookings
-- ============================================================
create table public.bookings (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  tutor_id uuid references public.profiles(id) on delete cascade not null,
  subject text not null,
  date date not null,
  time text not null,
  duration integer not null default 60,
  location text not null,
  notes text,
  status text default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  review_left boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: reviews
-- ============================================================
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  tutor_id uuid references public.profiles(id) on delete cascade not null,
  parent_id uuid references public.profiles(id) on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete set null,
  parent_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  tutor_response text,
  tutor_response_date date,
  date date default current_date,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  read boolean default false,
  link text,
  created_at timestamptz default now()
);

-- ============================================================
-- TABLE: favorites
-- ============================================================
create table public.favorites (
  id uuid primary key default uuid_generate_v4(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  tutor_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(parent_id, tutor_id)
);

-- ============================================================
-- INDEX (performances)
-- ============================================================
create index on public.messages(conversation_id, created_at);
create index on public.bookings(parent_id);
create index on public.bookings(tutor_id);
create index on public.reviews(tutor_id);
create index on public.notifications(user_id, read);
create index on public.favorites(parent_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.tutors enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.favorites enable row level security;

-- PROFILES
create policy "Profils visibles par tous" on public.profiles for select using (true);
create policy "Utilisateur modifie son propre profil" on public.profiles for update using (auth.uid() = id);
create policy "Inscription : créer son profil" on public.profiles for insert with check (auth.uid() = id);

-- TUTORS
create policy "Tuteurs visibles par tous" on public.tutors for select using (true);
create policy "Tuteur modifie son profil" on public.tutors for update using (auth.uid() = id);
create policy "Tuteur crée son profil" on public.tutors for insert with check (auth.uid() = id);
create policy "Admin met à jour n'importe quel tuteur" on public.tutors for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- CONVERSATIONS
create policy "Voir ses conversations" on public.conversations for select
  using (auth.uid() = participant_1 or auth.uid() = participant_2);
create policy "Créer une conversation" on public.conversations for insert
  with check (auth.uid() = participant_1 or auth.uid() = participant_2);
create policy "Mettre à jour sa conversation" on public.conversations for update
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

-- MESSAGES
create policy "Voir les messages de sa conversation" on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  ));
create policy "Envoyer un message" on public.messages for insert
  with check (auth.uid() = sender_id);
create policy "Marquer comme lu" on public.messages for update
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  ));

-- BOOKINGS
create policy "Voir ses réservations" on public.bookings for select
  using (auth.uid() = parent_id or auth.uid() = tutor_id);
create policy "Admin voit toutes les réservations" on public.bookings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Parent crée une réservation" on public.bookings for insert
  with check (auth.uid() = parent_id);
create policy "Modifier le statut d'une réservation" on public.bookings for update
  using (auth.uid() = parent_id or auth.uid() = tutor_id);

-- REVIEWS
create policy "Avis visibles par tous" on public.reviews for select using (true);
create policy "Parent publie un avis" on public.reviews for insert with check (auth.uid() = parent_id);
create policy "Tuteur répond à son avis" on public.reviews for update using (auth.uid() = tutor_id);

-- NOTIFICATIONS
create policy "Voir ses notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Mettre à jour ses notifications" on public.notifications for update using (auth.uid() = user_id);
create policy "Créer une notification" on public.notifications for insert with check (true);

-- FAVORITES
create policy "Voir ses favoris" on public.favorites for select using (auth.uid() = parent_id);
create policy "Ajouter un favori" on public.favorites for insert with check (auth.uid() = parent_id);
create policy "Supprimer un favori" on public.favorites for delete using (auth.uid() = parent_id);

-- ============================================================
-- REALTIME (messagerie temps réel)
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.notifications;

-- ============================================================
-- FONCTION: créer le profil automatiquement après inscription
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, first_name, last_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'parent'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
