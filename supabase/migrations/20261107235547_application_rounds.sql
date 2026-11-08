begin;
alter table public.application_milestones add column round jsonb check(round is null or jsonb_typeof(round)='object');
create function private.validate_round_metadata(r jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(r) is distinct from 'object' or r-array['stage','type','cancelled']<>'{}'::jsonb or coalesce(r->>'stage','') not in ('SCREEN','INTERVIEW') or coalesce(r->>'type','') not in ('recruiter','oa','take_home','technical','system_design','behavioral','hiring_manager','onsite','other') or (r?'cancelled' and jsonb_typeof(r->'cancelled')<>'boolean') then raise exception 'Invalid round stage/type' using errcode='22023';end if;
end $$;
revoke all on function private.validate_round_metadata(jsonb) from public,anon,authenticated;
create function private.validate_imported_rounds(rounds jsonb) returns void language plpgsql set search_path='' as $$
declare r jsonb; d text;
begin
 if jsonb_typeof(rounds) is distinct from 'array' then raise exception 'Rounds must be an array' using errcode='22023';end if;
 if jsonb_array_length(rounds)>100 or (select count(distinct value->>'id') from jsonb_array_elements(rounds))<>jsonb_array_length(rounds) then raise exception 'Round limit or duplicate IDs' using errcode='22023';end if;
 for r in select value from jsonb_array_elements(rounds) loop
  if jsonb_typeof(r) is distinct from 'object' or not r?&array['id','label','stage','type','phase','date','notes','cancelled'] or r-array['id','label','stage','type','phase','date','notes','cancelled']<>'{}'::jsonb
   or jsonb_typeof(r->'id')<>'string' or length(r->>'id') not between 1 and 80 or r->>'id' !~ '^[-a-zA-Z0-9_:.]+$'
   or jsonb_typeof(r->'label')<>'string' or length(trim(r->>'label')) not between 1 and 300
   or coalesce(r->>'phase','') not in ('received','scheduled','completed')
   or jsonb_typeof(r->'notes')<>'string' or length(r->>'notes')>2000 or jsonb_typeof(r->'cancelled')<>'boolean'
  then raise exception 'Invalid imported round' using errcode='22023';end if;
  perform private.validate_round_metadata(r-array['id','label','phase','date','notes']);
  d:=r->>'date';
  if d is not null then
   if jsonb_typeof(r->'date')<>'string' or d !~ '^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$' or to_char(left(d,10)::date,'YYYY-MM-DD')<>left(d,10) then raise exception 'Invalid round date' using errcode='22023';end if;
   perform d::timestamptz;
  end if;
 end loop;
end $$;
revoke all on function private.validate_imported_rounds(jsonb) from public,anon,authenticated;
create or replace function private.record_application_milestone_owned(owner_id uuid,app_id uuid,payload jsonb,source_kind text)
returns public.application_milestones language plpgsql security definer set search_path='' as $$
declare m public.application_milestones; s jsonb:=payload->'source'; date_value timestamptz; replacement_id uuid;
begin
 perform 1 from public.applications where id=app_id and user_id=owner_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-'round'-'supersedesId'-'eventKey'-'kind'-'label'-'occurredAt'-'phase'-'source'<>'{}'::jsonb
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200
  or jsonb_typeof(payload->'label') is distinct from 'string' or length(trim(coalesce(payload->>'label',''))) not between 1 and 300
  or coalesce(payload->>'kind','') not in ('submitted','recruiter_call','technical_round','interview','offer','rejected','withdrawn')
  or coalesce(payload->>'phase','') not in ('scheduled','completed','received')
  or jsonb_typeof(s) is distinct from 'object' or s->>'kind' is distinct from source_kind
  or s-'kind'-'messageId'-'subject'-'excerpt'-'receivedAt'-'timestampConfirmed'-'note'<>'{}'::jsonb or octet_length(s::text)>10000
 then raise exception 'Invalid milestone' using errcode='22023'; end if;
 if payload?'round' then
  perform private.validate_round_metadata(payload->'round');
  if payload->>'kind' not in ('recruiter_call','technical_round','interview') then raise exception 'Round metadata requires process kind' using errcode='22023';end if;
 end if;
 if source_kind='email' then
  if not (s ?& array['messageId','subject','excerpt','receivedAt'])
   or jsonb_typeof(s->'messageId') is distinct from 'string' or length(trim(coalesce(s->>'messageId',''))) not between 1 and 200
   or jsonb_typeof(s->'subject') is distinct from 'string' or length(trim(coalesce(s->>'subject',''))) not between 1 and 300
   or jsonb_typeof(s->'excerpt') is distinct from 'string' or length(trim(coalesce(s->>'excerpt',''))) not between 1 and 2000
   or coalesce(s->>'receivedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
  then raise exception 'Email evidence required' using errcode='22023'; end if;
  perform (s->>'receivedAt')::timestamptz;
 elsif source_kind='user_reported' then
  if jsonb_typeof(s->'note') is distinct from 'string' or length(trim(coalesce(s->>'note',''))) not between 1 and 2000 or s-'kind'-'note'-'timestampConfirmed'<>'{}'::jsonb then raise exception 'Candidate report required' using errcode='22023'; end if;
 elsif source_kind<>'user' then raise exception 'Unsupported milestone source' using errcode='22023';
 end if;
 if s ? 'note' and (jsonb_typeof(s->'note') is distinct from 'string' or length(s->>'note')>2000) then raise exception 'Invalid source note' using errcode='22023'; end if;
 if payload->'occurredAt' is not null and payload->'occurredAt'<>'null'::jsonb then
  if jsonb_typeof(payload->'occurredAt') is distinct from 'string' or coalesce(payload->>'occurredAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' or s->'timestampConfirmed' is distinct from 'true'::jsonb
  then raise exception 'Confirmed timestamp with explicit timezone required; otherwise leave date null' using errcode='22023'; end if;
  date_value:=(payload->>'occurredAt')::timestamptz;
 end if;
 if payload ? 'supersedesId' then
  if jsonb_typeof(payload->'supersedesId') is distinct from 'string' or payload->>'supersedesId' !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Invalid replacement ID' using errcode='22023'; end if;
  replacement_id:=(payload->>'supersedesId')::uuid;
  -- Serialize replacement writers on the original owned row; exact retries may replay.
  perform 1 from public.application_milestones where id=replacement_id and user_id=owner_id and application_id=app_id for update;
  if not found then raise exception 'Owned milestone not found' using errcode='P0002'; end if;
  if exists(select 1 from public.application_milestones where supersedes_id=replacement_id and (user_id<>owner_id or event_key<>payload->>'eventKey')) then raise exception 'Milestone already replaced; reread timeline' using errcode='40001'; end if;
 end if;
 insert into public.application_milestones(user_id,application_id,event_key,kind,label,occurred_at,phase,source,supersedes_id,round)
 values(owner_id,app_id,payload->>'eventKey',payload->>'kind',payload->>'label',date_value,payload->>'phase',s,replacement_id,payload->'round')
 on conflict(user_id,event_key) do nothing returning * into m;
 if m.id is null then
  select * into m from public.application_milestones where user_id=owner_id and event_key=payload->>'eventKey';
  if m.application_id is distinct from app_id or m.kind is distinct from payload->>'kind' or m.label is distinct from payload->>'label'
   or m.occurred_at is distinct from date_value or m.phase is distinct from payload->>'phase' or m.source is distinct from s or m.supersedes_id is distinct from replacement_id or m.round is distinct from payload->'round'
  then raise exception 'Milestone event key reused with different evidence' using errcode='40001'; end if;
 end if;
 insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
 values(owner_id,app_id,'milestone:'||m.id,'application_milestone',case when source_kind='user' then 'user' else 'agent' end,
  jsonb_build_object('text',m.label,'milestoneId',m.id,'kind',case when m.kind in ('recruiter_call','technical_round','interview') then 'interview' else m.kind end,'actionRequired',m.phase='scheduled','deadlineAt',m.occurred_at))
 on conflict(user_id,event_key) do nothing;
 -- Milestones are process observations, never application receipts or approvals.
 return m;
end $$;
revoke all on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) to service_role;
create or replace function private.validate_imported_actions(r jsonb) returns void
language plpgsql set search_path='' as $$
declare d text; stages text[]:=array['SAVED','APPLIED','SCREEN','INTERVIEW','OFFER']; stage jsonb; current_stage integer;
begin
 if r?'rounds' then perform private.validate_imported_rounds(r->'rounds');end if;
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
declare prior private.tracker_import_events; job public.imported_jobs; v integer; result jsonb; changes jsonb:=payload->'changes'; merged jsonb; round_level integer; current_level integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['id','expectedVersion','eventKey','changes']<>'{}'
 or not payload ?& array['id','expectedVersion','eventKey','changes']
 or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^\d{1,9}$'
 or coalesce(payload->>'eventKey','') !~ '^[-a-zA-Z0-9_:.]{1,160}$'
 or jsonb_typeof(changes) is distinct from 'object' or changes='{}'::jsonb
 or changes-array['status','statusDate','appliedDate','title','location','notes','archived','archivedDate','employmentType','nextAction','actionDate','needsAction','completedStages','rounds']<>'{}'
 then raise exception 'Invalid imported job update' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':simplify-import',0));
 select * into prior from private.tracker_import_events where user_id=owner_id and event_key=payload->>'eventKey';
 if found then if prior.request is distinct from payload then raise exception 'Import event reused' using errcode='40001';end if;return prior.result;end if;
 select version into v from private.tracker_import_versions where user_id=owner_id;
 if coalesce(v,0)<>(payload->>'expectedVersion')::integer then raise exception 'Tracker changed; read again' using errcode='40001';end if;
 select * into job from public.imported_jobs where user_id=owner_id and id=(payload->>'id')::uuid for update;
 if not found then raise exception 'Imported job not found' using errcode='P0002';end if;
 merged:=job.record||changes;
 if merged?'rounds' then
  perform private.validate_imported_rounds(merged->'rounds');
  select max(case value->>'stage' when 'INTERVIEW' then 4 else 3 end) into round_level from jsonb_array_elements(merged->'rounds') where value->'cancelled'='false'::jsonb;
  current_level:=array_position(array['SAVED','APPLIED','SCREEN','INTERVIEW','OFFER'],merged->>'status');
  if current_level is not null and round_level>current_level then merged:=jsonb_set(merged,'{status}',to_jsonb(case when round_level=4 then 'INTERVIEW'::text else 'SCREEN'::text end));end if;
 end if;
 -- Reuse the exact row validator used by browser and MCP imports.
 perform private.validate_imported_actions(merged);
 perform private.simplify_import_owned(owner_id,'preview',jsonb_build_object('rows',jsonb_build_array(merged-array['nextAction','actionDate','needsAction','completedStages','rounds'])));
 update public.imported_jobs set record=merged where id=job.id and user_id=owner_id;
 v:=coalesce(v,0)+1;
 insert into private.tracker_import_versions values(owner_id,v) on conflict(user_id) do update set version=excluded.version;
 result:=jsonb_build_object('version',v,'record',jsonb_build_object('id',job.id,'record',merged,'source_rows',job.source_rows),'verifiedSubmission',false);
 insert into private.tracker_import_events values(owner_id,payload->>'eventKey',payload,result);
 return result;
end $$;
revoke all on function private.update_imported_job_owned(uuid,jsonb) from public,anon,authenticated;

create function private.application_rounds_context(owner_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'company',j.employer->>'company','title',j.employer->>'title','location',j.employer->>'location','url',j.canonical_url,'milestones',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'label',m.label,'phase',m.phase,'occurred_at',m.occurred_at,'supersedes_id',m.supersedes_id,'round',m.round)),'[]') from public.application_milestones m where m.user_id=owner_id and m.application_id=a.id))),'[]') from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id),
 'imports',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'record',i.record-array['notes'])),'[]') from public.imported_jobs i where i.user_id=owner_id));
$$;
revoke all on function private.application_rounds_context(uuid) from public,anon,authenticated;
alter function public.agent_dispatch(text,text,jsonb) rename to rounds_previous_dispatch;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql set search_path='' as $$
declare c private.agent_connections;
begin
 if operation='applications.round_stats' then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if c.user_id is null or not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
  if payload<>'{}'::jsonb then raise exception 'No stats arguments accepted' using errcode='22023';end if;
  return private.application_rounds_context(c.user_id);
 end if;
 return public.rounds_previous_dispatch(credential_hash,operation,payload);
end $$;
revoke all on function public.rounds_previous_dispatch(text,text,jsonb),public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
