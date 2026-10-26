begin;
-- Extend only the existing private card recommendation JSON. No data rewrite,
-- table or column is introduced; historical legacy assessments remain readable.
create or replace function private.validate_job_recommendation() returns trigger
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
  -- Any compact dimension selects the closed four-score contract. Legacy
  -- percent/evidence/factors payloads continue through the original branch below.
  if jsonb_typeof(a)='object' and a ?| array['skillsExperience','compensation','wellbeingCulture','locationWorkSetting'] then
   if not a ?& array['skillsExperience','compensation','wellbeingCulture','locationWorkSetting','assessedAt']
    or exists(select 1 from jsonb_object_keys(a) field where field not in ('skillsExperience','compensation','wellbeingCulture','locationWorkSetting','assessedAt','percent','evidence')) then
    raise exception 'Compact assessment needs exactly four dimensions and observation time' using errcode='22023';end if;
   foreach k in array array['skillsExperience','compensation','wellbeingCulture','locationWorkSetting'] loop
    f:=a->k;
    if jsonb_typeof(f) is distinct from 'object' or not (f ?& array['score','reasoning'])
     or exists(select 1 from jsonb_object_keys(f) field where field not in ('score','reasoning'))
     or jsonb_typeof(f->'score') not in ('number','null') or jsonb_typeof(f->'reasoning') is distinct from 'string'
     or length(trim(f->>'reasoning')) not between 1 and 240 or length(f->>'reasoning')>240 then
     raise exception 'Invalid compact assessment dimension' using errcode='22023';end if;
    if jsonb_typeof(f->'score')='number' and (f->>'score')::numeric not between 0 and 100 then
     raise exception 'Compact assessment score out of range' using errcode='22023';end if;
   end loop;
   if a ? 'percent' and (jsonb_typeof(a->'percent') is distinct from 'number' or (a->>'percent')::numeric not between 0 and 100) then
    raise exception 'Invalid compact assessment percent' using errcode='22023';end if;
   if a ? 'evidence' and (jsonb_typeof(a->'evidence') is distinct from 'string' or length(trim(a->>'evidence')) not between 1 and 1000 or length(a->>'evidence')>1000) then
    raise exception 'Invalid compact assessment evidence' using errcode='22023';end if;
   if jsonb_typeof(a->'assessedAt') is distinct from 'string' or length(a->>'assessedAt')>40
    or a->>'assessedAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then
    raise exception 'Compact assessment needs observation time' using errcode='22023';end if;
   begin perform (a->>'assessedAt')::timestamptz;exception when others then raise exception 'Invalid assessment timestamp' using errcode='22023';end;
   return new;
  end if;
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
comment on column public.batch_items.recommendation is 'Private agent research. matchAssessment accepts four compact dimensions {score:number|null,reasoning}, assessedAt and optional percent/evidence; legacy percent/evidence/assessedAt/factors remain supported. Missing scores remain unknown. Scores never grant submission authority.';
commit;
