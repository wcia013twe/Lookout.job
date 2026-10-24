begin;
-- Extend the existing private recommendation document, not public employer data.
-- Historical batches remain immutable: absent assessments/gaps stay unknown.
create function private.validate_job_recommendation() returns trigger
language plpgsql set search_path='' as $$
declare r jsonb:=new.recommendation; a jsonb; f jsonb; k text;
begin
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'Recommendation must be an object' using errcode='22023';end if;
 foreach k in array array['materialGap','sourceFreshness'] loop
  if r ? k and (jsonb_typeof(r->k) is distinct from 'string' or length(trim(r->>k)) not between 1 and 4000) then raise exception 'Invalid recommendation %',k using errcode='22023';end if;
 end loop;
 if r ? 'priority' and (jsonb_typeof(r->'priority') is distinct from 'string' or r->>'priority' not in ('Apply Now','Strong Consider','Skip Unless Team Fit')) then raise exception 'Invalid recommendation priority' using errcode='22023';end if;
 if r ? 'matchAssessment' then
  a:=r->'matchAssessment';
  if jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(a->'percent') is distinct from 'number' then raise exception 'Invalid match assessment' using errcode='22023';end if;
  if (a->>'percent')::numeric not between 0 and 100 or jsonb_typeof(a->'evidence') is distinct from 'string' or length(trim(a->>'evidence')) not between 1 and 4000
   or jsonb_typeof(a->'assessedAt') is distinct from 'string' or length(a->>'assessedAt')>40 or a->>'assessedAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then raise exception 'Assessment needs evidence and observation time' using errcode='22023';end if;
  begin perform (a->>'assessedAt')::timestamptz;exception when others then raise exception 'Invalid assessment timestamp' using errcode='22023';end;
  if jsonb_typeof(a->'factors') is distinct from 'array' then raise exception 'Assessment needs factors' using errcode='22023';end if;
  if jsonb_array_length(a->'factors') not between 1 and 12 then raise exception 'Assessment needs 1–12 factors' using errcode='22023';end if;
  for f in select value from jsonb_array_elements(a->'factors') loop
   if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f->'label') is distinct from 'string' or length(trim(f->>'label')) not between 1 and 120
    or jsonb_typeof(f->'rating') is distinct from 'string' or length(trim(f->>'rating')) not between 1 and 80
    or jsonb_typeof(f->'reason') is distinct from 'string' or length(trim(f->>'reason')) not between 1 and 4000
    or not (f ? 'value') or jsonb_typeof(f->'value') not in ('number','null') then raise exception 'Invalid assessment factor' using errcode='22023';end if;
   if jsonb_typeof(f->'value')='number' and (f->>'value')::numeric not between 0 and 100 then raise exception 'Factor score out of range' using errcode='22023';end if;
  end loop;
 end if;
 return new;
end $$;
revoke all on function private.validate_job_recommendation() from public,anon,authenticated;
create trigger validate_job_recommendation before insert or update of recommendation on public.batch_items for each row execute function private.validate_job_recommendation();
comment on column public.batch_items.recommendation is 'Private agent research: whyItFits, materialGap, optional matchAssessment {percent,evidence,assessedAt,factors[{label,value,rating,reason}]}, sourceFreshness and provenance. Missing values remain unknown. Scores never grant submission authority.';
commit;
