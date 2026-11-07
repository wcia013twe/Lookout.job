begin;
-- Structured imported progress stays in the existing owned record, not notes or
-- a parallel workflow. Browser/MCP share this writer, version lock and replay log.
create function private.validate_imported_actions(r jsonb) returns void
language plpgsql set search_path='' as $$
declare d text; stages text[]:=array['SAVED','APPLIED','SCREEN','INTERVIEW','OFFER']; stage jsonb; current_stage integer;
begin
 if r?'nextAction' and r->'nextAction'<>'null'::jsonb and (jsonb_typeof(r->'nextAction')<>'string' or length(r->>'nextAction')>300) then raise exception 'Invalid next action' using errcode='22023';end if;
 if r?'needsAction' and jsonb_typeof(r->'needsAction')<>'boolean' then raise exception 'Invalid needs action flag' using errcode='22023';end if;
 d:=r->>'actionDate';
 if d is not null and (jsonb_typeof(r->'actionDate')<>'string' or d !~ '^\d{4}-\d{2}-\d{2}$' or to_char(d::date,'YYYY-MM-DD')<>d) then raise exception 'Invalid action date' using errcode='22023';end if;
 if (d is not null or r->'needsAction'='true'::jsonb) and coalesce(trim(r->>'nextAction'),'')='' then raise exception 'Name the next action before setting its date or flag' using errcode='22023';end if;
 if r?'completedStages' then
  if jsonb_typeof(r->'completedStages')<>'array' then raise exception 'Invalid completed stages' using errcode='22023';end if;
  if jsonb_array_length(r->'completedStages')>5 or (select count(distinct value) from jsonb_array_elements(r->'completedStages'))<>jsonb_array_length(r->'completedStages') then raise exception 'Invalid completed stages' using errcode='22023';end if;
  current_stage:=array_position(stages,r->>'status');
  for stage in select value from jsonb_array_elements(r->'completedStages') loop
   if jsonb_typeof(stage)<>'string' or not (stage#>>'{}')=any(stages) or (current_stage is not null and array_position(stages,stage#>>'{}')>current_stage) then raise exception 'Invalid completed stage for current status' using errcode='22023';end if;
  end loop;
 end if;
end $$;
revoke all on function private.validate_imported_actions(jsonb) from public,anon,authenticated;
create or replace function private.update_imported_job_owned(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.tracker_import_events; job public.imported_jobs; v integer; result jsonb; changes jsonb:=payload->'changes'; merged jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['id','expectedVersion','eventKey','changes']<>'{}'
 or not payload ?& array['id','expectedVersion','eventKey','changes']
 or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^\d{1,9}$'
 or coalesce(payload->>'eventKey','') !~ '^[-a-zA-Z0-9_:.]{1,160}$'
 or jsonb_typeof(changes) is distinct from 'object' or changes='{}'::jsonb
 or changes-array['status','statusDate','appliedDate','title','location','notes','archived','archivedDate','employmentType','nextAction','actionDate','needsAction','completedStages']<>'{}'
 then raise exception 'Invalid imported job update' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':simplify-import',0));
 select * into prior from private.tracker_import_events where user_id=owner_id and event_key=payload->>'eventKey';
 if found then if prior.request is distinct from payload then raise exception 'Import event reused' using errcode='40001';end if;return prior.result;end if;
 select version into v from private.tracker_import_versions where user_id=owner_id;
 if coalesce(v,0)<>(payload->>'expectedVersion')::integer then raise exception 'Tracker changed; read again' using errcode='40001';end if;
 select * into job from public.imported_jobs where user_id=owner_id and id=(payload->>'id')::uuid for update;
 if not found then raise exception 'Imported job not found' using errcode='P0002';end if;
 merged:=job.record||changes;
 -- Reuse the exact row validator used by browser and MCP imports.
 perform private.validate_imported_actions(merged);
 perform private.simplify_import_owned(owner_id,'preview',jsonb_build_object('rows',jsonb_build_array(merged-array['nextAction','actionDate','needsAction','completedStages'])));
 update public.imported_jobs set record=merged where id=job.id and user_id=owner_id;
 v:=coalesce(v,0)+1;
 insert into private.tracker_import_versions values(owner_id,v) on conflict(user_id) do update set version=excluded.version;
 result:=jsonb_build_object('version',v,'record',jsonb_build_object('id',job.id,'record',merged,'source_rows',job.source_rows),'verifiedSubmission',false);
 insert into private.tracker_import_events values(owner_id,payload->>'eventKey',payload,result);
 return result;
end $$;
revoke all on function private.update_imported_job_owned(uuid,jsonb) from public,anon,authenticated;
commit;
