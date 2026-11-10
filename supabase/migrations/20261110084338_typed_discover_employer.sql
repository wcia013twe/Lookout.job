begin;
-- Public posting facts only. No new grants, owner bypass, or application writes.
create function private.normalize_discover_employer(employer jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare field text; value jsonb; kind text; limit_size integer; normalized text; result jsonb:=employer;
begin
 if jsonb_typeof(employer) is distinct from 'object' then raise exception 'employer must be an object' using errcode='22023';end if;
 foreach field in array array['company','title','employmentType','location'] loop
  if not employer ? field then raise exception 'employer.% is required; employmentType must be FT or Internship, location may be empty when unknown',field using errcode='22023';end if;
 end loop;
 normalized:=case lower(trim(employer->>'employmentType')) when 'ft' then 'FT' when 'full-time' then 'FT' when 'full time' then 'FT' when 'full_time' then 'FT' when 'internship' then 'Internship' end;
 if jsonb_typeof(employer->'employmentType') is distinct from 'string' or normalized is null then raise exception 'employer.employmentType must be FT or Internship; verify the posting rather than guessing' using errcode='22023';end if;
 result:=jsonb_set(result,'{employmentType}',to_jsonb(normalized));
 for field,value in select e.key,e.value from jsonb_each(result) e loop
  kind:=jsonb_typeof(value);
  if field=any(array['postedDate','discoveredDate','deadline']) then
   if kind='null' then continue;end if;
   if kind<>'string' or (value#>>'{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'employer.% must be YYYY-MM-DD or null',field using errcode='22023';end if;
   begin
    if ((value#>>'{}')::date)::text<>value#>>'{}' then raise exception 'Invalid date' using errcode='22023';end if;
   exception when datetime_field_overflow or invalid_datetime_format then raise exception 'employer.% must be YYYY-MM-DD or null',field using errcode='22023';end;
  elsif field='locations' then
   if kind<>'array' then raise exception 'employer.locations must be an array of strings' using errcode='22023';end if;
   if jsonb_array_length(value)>100 or exists(select 1 from jsonb_array_elements(value) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>1000) then raise exception 'employer.locations must be a bounded array of strings' using errcode='22023';end if;
  else
   limit_size:=case when field=any(array['company','title','employmentType','category']) then 200 when field='location' then 1000 when field='description' then 60000 when field='compensation' then 2000 when field=any(array['source','applicationUrl']) then 2048 when field=any(array['sourceFreshness','eligibility']) then 4000 end;
   if limit_size is null then raise exception 'Unknown employer.%',field using errcode='22023';end if;
   if kind<>'string' or length(value#>>'{}')>limit_size or (field=any(array['company','title']) and trim(value#>>'{}')='') or (field='applicationUrl' and (value#>>'{}') !~ '^https://') then raise exception 'Invalid employer.%: use the published field type and bounds',field using errcode='22023';end if;
  end if;
 end loop;
 return result;
end $$;
revoke all on function private.normalize_discover_employer(jsonb) from public,anon,authenticated;

-- Guard the canonical publisher behind both MCP and gateway transports, inside
-- the original immutable-batch/replay branch, before any catalog insert.
do $install$
declare definition text; old text:=$old$v_job_id := 'agent-'||md5(job->>'canonicalUrl');$old$;
begin
 definition:=pg_get_functiondef('private.agent_dispatch_core(text,text,jsonb)'::regprocedure);
 if position(old in definition)=0 then raise exception 'Discover publication validation hook missing';end if;
 execute replace(definition,old,$new$job := jsonb_set(job,'{employer}',private.normalize_discover_employer(job->'employer'));
          v_job_id := 'agent-'||md5(job->>'canonicalUrl');$new$);
end $install$;

-- Repair only unambiguous aliases. Unknown types stay unknown. Do not touch
-- recommendations, personal statuses, drafts, approvals, receipts or timestamps.
update public.jobs set employer=jsonb_set(employer,'{employmentType}',to_jsonb(case lower(trim(employer->>'employmentType')) when 'internship' then 'Internship' else 'FT' end))
where lower(trim(employer->>'employmentType')) in ('ft','full-time','full time','full_time','internship')
and employer->>'employmentType' not in ('FT','Internship');
commit;
