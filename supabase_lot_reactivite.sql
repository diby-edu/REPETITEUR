-- ============================================================
-- MonRépétiteur — Réactivité (taux de réponse aux demandes)
--
-- Mesure la rapidité/le taux de réponse du répétiteur aux demandes
-- de recrutement. Une demande non répondue sous 72h compte comme
-- « traitée mais non répondue » (pénalise le taux).
--
-- Ajouts uniquement, idempotent.
-- ============================================================

-- Horodatage de la réponse (accept/refus) du répétiteur
alter table public.engagements
  add column if not exists responded_at timestamptz;

-- Vue de stats par répétiteur (lecture publique — signal qualité, pas de PII)
create or replace view public.tutor_response_stats as
select
  tutor_id,
  decided,
  responded,
  avg_response_hours,
  case when decided > 0 then round(responded::numeric / decided, 2) else null end as response_rate
from (
  select
    e.tutor_id,
    count(*) filter (
      where e.responded_at is not null
         or e.created_at < now() - interval '72 hours'
    ) as decided,
    count(*) filter (where e.responded_at is not null) as responded,
    round(
      avg(extract(epoch from (e.responded_at - e.created_at)) / 3600.0)
        filter (where e.responded_at is not null)::numeric,
      1
    ) as avg_response_hours
  from public.engagements e
  group by e.tutor_id
) s;

grant select on public.tutor_response_stats to anon, authenticated;

-- Vérif : select * from public.tutor_response_stats order by response_rate desc nulls last;
