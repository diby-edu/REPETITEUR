-- ============================================================
-- MonRépétiteur — Lot 2b : formulaire « Je recrute »
--   - engagements.child_label : libellé de l'enfant (multi-enfants)
--   - notification enrichie à la création d'une demande :
--       * répétiteur (sans jamais les coordonnées du parent)
--       * admins (suivi / modération)
--
-- Ajouts uniquement, idempotent. À coller dans Supabase > SQL Editor.
-- ============================================================

-- 1) Colonne enfant
alter table public.engagements
  add column if not exists child_label text;

-- 2) Notification à la création (remplace handle_engagement_created)
create or replace function public.handle_engagement_created()
returns trigger as $$
declare
  p public.profiles%rowtype;
  class_label text;
  who text;
begin
  select * into p from public.profiles where id = new.parent_id;
  select label into class_label from public.level_packages where level_key = new.level_key;

  who := coalesce(p.first_name || ' ' || p.last_name, 'Un parent');

  -- ── Répétiteur : demande reçue (les coordonnées du parent ne sont
  --    jamais partagées — protégées par la RLS profiles) ──
  insert into public.notifications (user_id, type, title, message, link)
  values (
    new.tutor_id,
    'engagement_proposed',
    'Nouvelle demande de recrutement',
    who || ' souhaite vous recruter'
      || case
           when class_label is not null then ' en ' || class_label
           when new.subject is not null then ' en ' || new.subject
           else ''
         end
      || case when new.child_label is not null then ' pour ' || new.child_label else '' end
      || ' (' || replace(to_char(new.monthly_rate, 'FM999,999,999'), ',', ' ') || ' FCFA/mois).',
    '/tableau-de-bord/repetiteur'
  );

  -- ── Admins : suivi / modération ──
  insert into public.notifications (user_id, type, title, message, link)
  select a.id,
         'engagement_request',
         'Nouvelle demande de recrutement',
         who || ' a fait une demande de recrutement'
           || case when class_label is not null then ' (' || class_label || ')' else '' end || '.',
         '/admin?tab=Contrats'
  from public.profiles a
  where a.role = 'admin';

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Le trigger existe déjà (on_engagement_created) ; rappel idempotent :
drop trigger if exists on_engagement_created on public.engagements;
create trigger on_engagement_created
  after insert on public.engagements
  for each row execute function public.handle_engagement_created();

-- Vérif : select id, parent_id, tutor_id, level_key, child_label, monthly_rate
--         from public.engagements order by created_at desc limit 5;
