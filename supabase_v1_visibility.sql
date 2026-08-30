-- ============================================================
-- MonRépétiteur — V1 : refonte visibilité « seed-then-gate »
-- À coller dans Supabase > SQL Editor > New query > Run
-- ------------------------------------------------------------
-- Modèle :
--  • Fondateur = 100 premiers vérifiés → VISIBLE gratuitement tant que
--    vérifié (marqueur is_founder à vie), MAIS paie avant d'accepter un
--    contrat (comme tout le monde). Plus d'abonnement promo offert, plus
--    de délai de grâce « 7 jours ».
--  • Non-fondateur → INVISIBLE dans les recherches sans abonnement payant.
--  • Le filtre visibilité (vérifié && !suspendu && (fondateur || abo payant))
--    est appliqué CÔTÉ CLIENT ; la vue expose juste is_founder.
-- Idempotent. Les fondateurs existants gardent is_founder (restent visibles).
-- ============================================================

-- 1) 100 places fondateur (au lieu de 50)
update public.referral_config set welcome_max_tutors = 100 where id = 1;

-- 2) grant_founder_status : ne donne PLUS d'abonnement promo — juste le flag.
create or replace function public.grant_founder_status(p_tutor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cfg public.referral_config%rowtype; n int;
begin
  select * into cfg from public.referral_config where id = 1;
  if cfg.id is null or not cfg.welcome_enabled then return; end if;

  -- déjà servi ?
  if exists (select 1 from public.tutors where id = p_tutor and welcome_claimed) then return; end if;
  -- places restantes ? (0 = illimité)
  select count(*) into n from public.tutors where welcome_claimed;
  if cfg.welcome_max_tutors > 0 and n >= cfg.welcome_max_tutors then return; end if;

  update public.tutors set
    is_founder      = true,
    welcome_claimed = true
  where id = p_tutor and verification_status = 'verified';
end;
$$;

-- 3) Plus de délai de grâce fondateur : on neutralise le trigger de conversion.
drop trigger if exists founder_first_contract on public.engagements;

-- 4) Exposer is_founder dans la vue publique (le client filtre la visibilité).
--    Redéfinition complète (basée sur la version courante avatar_url + diploma_names + offers).
create or replace view public.public_tutors as
  select
    p.id, p.first_name, p.last_name, p.city, p.quartier, p.avatar_color, p.avatar_url, p.join_date,
    t.bio, t.subjects, t.levels, t.monthly_rate, t.modalities, t.availability,
    t.verification_status, t.rejection_reason,
    t.subscription_plan, t.subscription_start, t.subscription_end, t.subscription_status,
    t.rating, t.review_count, t.session_count, t.profile_views, t.monthly_requests,
    t.is_active, t.suspended, t.is_founder,
    (
      select coalesce(array_agg(d->>'name'), '{}'::text[])
      from jsonb_array_elements(coalesce(t.documents->'diplomes', '[]'::jsonb)) d
      where t.verification_status = 'verified' and (d->>'name') is not null
    ) as diploma_names,
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object('level_key', o.level_key, 'subjects', o.subjects, 'monthly_price', o.monthly_price)
          order by o.monthly_price
        ),
        '[]'::jsonb)
      from public.tutor_offers o
      where o.tutor_id = p.id and o.active
    ) as offers
  from public.profiles p
  join public.tutors t on t.id = p.id
  where p.role = 'tutor';

grant select on public.public_tutors to anon, authenticated;

-- ── Vérif ──
-- select id, first_name, is_founder, subscription_plan, subscription_status
--   from public.public_tutors;
