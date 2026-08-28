-- ============================================================
-- MonRépétiteur — Lot 4 : modération admin (messages « Modération »)
--
-- L'admin peut écrire dans n'importe quelle conversation. Ses messages
-- s'affichent en ROUGE avec un badge « Modération · MonRépétiteur »,
-- visibles des deux parties. Un flag serveur garantit qu'un message n'est
-- « de modération » QUE si son auteur est admin (anti-usurpation).
--
-- Ajouts uniquement, idempotent.
-- ============================================================

alter table public.messages
  add column if not exists is_moderation boolean not null default false;

-- Flag serveur : is_moderation = true UNIQUEMENT si l'auteur est admin.
create or replace function public.set_message_moderation_flag()
returns trigger as $$
begin
  new.is_moderation := public.is_admin();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists set_message_moderation_flag on public.messages;
create trigger set_message_moderation_flag
  before insert on public.messages
  for each row execute function public.set_message_moderation_flag();

-- L'admin peut écrire dans n'importe quelle conversation.
drop policy if exists "admin_inserts_messages" on public.messages;
create policy "admin_inserts_messages" on public.messages
  for insert with check (public.is_admin());

-- L'admin peut lire tous les messages (modération).
drop policy if exists "admin_reads_messages" on public.messages;
create policy "admin_reads_messages" on public.messages
  for select using (public.is_admin());
