begin;
-- Additive: old events and idempotency keys retain their version-1 meaning.
alter table public.agent_audit_runs drop constraint agent_audit_runs_area_check;
alter table public.agent_audit_runs add constraint agent_audit_runs_area_check
 check(area in ('action_board','discover','applications','network','toolkit','setup','other'));
alter table public.agent_audit_events
 add column schema_version integer not null default 1 check(schema_version in (1,2)),
 add column feature text check(feature in ('action_board','discover','applications','network','toolkit','setup','other')),
 add column dimension text check(dimension in ('personalization','decision_quality','consistency','performance','safety')),
 add column scenario_id text check(length(btrim(scenario_id)) between 1 and 200),
 add column check_id text check(length(btrim(check_id)) between 1 and 200),
 add column actor text not null default 'agent' check(actor in ('agent','runner','evaluator')),
 add constraint audit_v2_feature_required check(schema_version=1 or feature is not null);
create index agent_audit_events_checks on public.agent_audit_events(user_id,scenario_id,check_id,run_id)
 where schema_version=2 and kind='assertion';
comment on column public.agent_audit_events.actor is 'RPC always records agent. Runner/evaluator reserved for separately authenticated future ingestion; callers cannot assert actor or independent provenance.';
comment on column public.agent_audit_events.schema_version is '1 legacy observation; 2 structured benchmark evidence. Agent assertions are self-checks, not independent grades.';

create function private.audit_benchmark_event_valid(item jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare d jsonb:=coalesce(item->'data','{}'); k text; v jsonb;
begin
 if item ? 'schemaVersion' and (jsonb_typeof(item->'schemaVersion') is distinct from 'number' or item->>'schemaVersion' not in ('1','2')) then return false;end if;
 if coalesce(item->>'schemaVersion','1')='1' then
  return not (item ?| array['feature','dimension','scenarioId','checkId']);
 end if;
 if jsonb_typeof(item->'feature') is distinct from 'string' or item->>'feature' not in ('action_board','discover','applications','network','toolkit','setup','other') then return false;end if;
 if item ? 'dimension' and (jsonb_typeof(item->'dimension') is distinct from 'string' or item->>'dimension' not in ('personalization','decision_quality','consistency','performance','safety')) then return false;end if;
 foreach k in array array['scenarioId','checkId'] loop
  if item ? k and (jsonb_typeof(item->k) is distinct from 'string' or length(btrim(item->>k)) not between 1 and 200) then return false;end if;
 end loop;
 if item->>'kind'='context.loaded' then
  if jsonb_typeof(d->'contextRefs') is distinct from 'array' then return false;end if;
  if jsonb_array_length(d->'contextRefs')>50 then return false;end if;
 elsif item->>'kind'='decision' then
  foreach k in array array['chosenAction','justification'] loop
   if jsonb_typeof(d->k) is distinct from 'string' or length(btrim(d->>k)) not between 1 and 4000 then return false;end if;
  end loop;
  foreach k in array array['preferencesApplied','evidenceRefs'] loop
   if jsonb_typeof(d->k) is distinct from 'array' then return false;end if;
   if jsonb_array_length(d->k)>50 then return false;end if;
  end loop;
 elsif item->>'kind'='assertion' then
  if not (item ?& array['dimension','scenarioId','checkId']) or coalesce(d->>'evaluationSource','')<>'self_check'
   or coalesce(d->>'status','') not in ('pass','fail','not_applicable','not_evaluated') then return false;end if;
  foreach k in array array['expected','observed','rubricVersion'] loop
   if jsonb_typeof(d->k) is distinct from 'string' or length(btrim(d->>k)) not between 1 and (case when k='rubricVersion' then 200 else 4000 end) then return false;end if;
  end loop;
  if jsonb_typeof(d->'evidenceEventKeys') is distinct from 'array' then return false;end if;
  if jsonb_array_length(d->'evidenceEventKeys')>50 or (d->>'status' in ('pass','fail') and jsonb_array_length(d->'evidenceEventKeys')=0) then return false;end if;
  for v in select value from jsonb_array_elements(d->'evidenceEventKeys') loop
   if jsonb_typeof(v) is distinct from 'string' or length(btrim(v #>> '{}')) not between 1 and 200 then return false;end if;
  end loop;
 elsif item->>'kind'='usage' then
  if coalesce(d->>'metricsScope','') not in ('task','audit') then return false;end if;
  foreach k in array array['durationMs','toolCallCount','inputTokens','outputTokens','costUsd'] loop
   if d ? k and d->k<>'null'::jsonb then
    if jsonb_typeof(d->k) is distinct from 'number' then return false;end if;
    if (d->>k)::numeric<0 or (k<>'costUsd' and ((d->>k)::numeric<>trunc((d->>k)::numeric) or (d->>k)::numeric>9007199254740991)) then return false;end if;
   end if;
  end loop;
 end if;
 return true;
end $$;
revoke all on function private.audit_benchmark_event_valid(jsonb) from public,anon,authenticated;
grant execute on function private.audit_benchmark_event_valid(jsonb) to service_role;

create or replace function public.agent_audit_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; r public.agent_audit_runs; e public.agent_audit_events;
 item jsonb; results jsonb:='[]'; limit_count integer; cursor_seq bigint; next_seq bigint;
begin
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid credential' using errcode='28000';end if;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
 if operation not in ('audit.start','audit.append','audit.read') then raise exception 'Unknown audit operation' using errcode='22023';end if;
 if operation<>'audit.read' and not 'activity:write'=any(c.scopes) then raise exception 'Activity scope required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>200000 then raise exception 'Bounded object required' using errcode='22023';end if;
 if operation='audit.start' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('eventKey','task','area','mode','metadata'))
   or length(btrim(coalesce(payload->>'eventKey',''))) not between 1 and 200
   or jsonb_typeof(payload->'task') is distinct from 'string' or length(btrim(payload->>'task')) not between 1 and 10000
   or coalesce(payload->>'area','') not in ('action_board','discover','applications','network','toolkit','setup','other')
   or coalesce(payload->>'mode','') not in ('live','controlled')
   or jsonb_typeof(coalesce(payload->'metadata','{}')) is distinct from 'object'
   or octet_length(coalesce(payload->'metadata','{}')::text)>128000
   or not private.audit_payload_safe(payload) then raise exception 'Invalid or unredacted run metadata' using errcode='22023';end if;
  insert into public.agent_audit_runs(user_id,connection_id,event_key,task,area,mode,metadata)
   values(c.user_id,c.id,payload->>'eventKey',payload->>'task',payload->>'area',payload->>'mode',coalesce(payload->'metadata','{}'))
   on conflict(user_id,event_key) do nothing returning * into r;
  if r.id is null then
   select * into r from public.agent_audit_runs where user_id=c.user_id and event_key=payload->>'eventKey';
   if r.task is distinct from payload->>'task' or r.area is distinct from payload->>'area' or r.mode is distinct from payload->>'mode' or r.metadata<>coalesce(payload->'metadata','{}') then raise exception 'Retry payload changed' using errcode='40001';end if;
  end if;
  return to_jsonb(r);
 end if;
 select * into r from public.agent_audit_runs where id=(payload->>'runId')::uuid and user_id=c.user_id;
 if not found then raise exception 'Owned audit run required' using errcode='P0002';end if;
 if operation='audit.append' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('runId','events'))
   or jsonb_typeof(payload->'events') is distinct from 'array' then raise exception 'Event batch required' using errcode='22023';end if;
  if jsonb_array_length(payload->'events') not between 1 and 25 or not private.audit_payload_safe(payload) then raise exception 'Invalid or unredacted event batch' using errcode='22023';end if;
  -- Serialize one run without mutating its immutable start record.
  perform pg_advisory_xact_lock(hashtextextended(r.id::text,827));
  for item in select value from jsonb_array_elements(payload->'events') loop
   if jsonb_typeof(item) is distinct from 'object' then raise exception 'Event object required' using errcode='22023';end if;
   if exists(select 1 from jsonb_object_keys(item) k where k not in ('eventKey','kind','summary','toolName','occurredAt','data','schemaVersion','feature','dimension','scenarioId','checkId'))
    or length(btrim(coalesce(item->>'eventKey',''))) not between 1 and 200
    or coalesce(item->>'kind','') !~ '^[a-z][a-z0-9_.-]{0,79}$'
    or (item ? 'summary' and jsonb_typeof(item->'summary') is distinct from 'string') or length(coalesce(item->>'summary',''))>4000
    or (item ? 'toolName' and (jsonb_typeof(item->'toolName') is distinct from 'string' or length(item->>'toolName') not between 1 and 160))
    or (item->>'occurredAt' is not null and (jsonb_typeof(item->'occurredAt') is distinct from 'string' or item->>'occurredAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' or not isfinite((item->>'occurredAt')::timestamptz)))
    or jsonb_typeof(coalesce(item->'data','{}')) is distinct from 'object' or octet_length(coalesce(item->'data','{}')::text)>128000
    or not private.audit_benchmark_event_valid(item)
    then raise exception 'Invalid audit event' using errcode='22023';end if;
   if item->>'schemaVersion'='2' and item->>'kind'='assertion' and exists(
    select 1 from jsonb_array_elements_text(item->'data'->'evidenceEventKeys') ref
    where not exists(select 1 from public.agent_audit_events prior where prior.run_id=r.id and prior.event_key=ref)
   ) then raise exception 'Assertion evidence must reference earlier events in this run' using errcode='22023';end if;
   insert into public.agent_audit_events(user_id,run_id,connection_id,event_key,kind,summary,tool_name,occurred_at,data,schema_version,feature,dimension,scenario_id,check_id)
    values(c.user_id,r.id,c.id,item->>'eventKey',item->>'kind',coalesce(item->>'summary',''),item->>'toolName',(item->>'occurredAt')::timestamptz,coalesce(item->'data','{}'),coalesce((item->>'schemaVersion')::integer,1),item->>'feature',item->>'dimension',item->>'scenarioId',item->>'checkId')
    on conflict(run_id,event_key) do nothing returning * into e;
   if e.sequence is null then
    select * into e from public.agent_audit_events where run_id=r.id and event_key=item->>'eventKey';
    if e.kind is distinct from item->>'kind' or e.summary<>coalesce(item->>'summary','') or e.tool_name is distinct from item->>'toolName' or e.occurred_at is distinct from (item->>'occurredAt')::timestamptz or e.data<>coalesce(item->'data','{}') or e.schema_version<>coalesce((item->>'schemaVersion')::integer,1) or e.feature is distinct from item->>'feature' or e.dimension is distinct from item->>'dimension' or e.scenario_id is distinct from item->>'scenarioId' or e.check_id is distinct from item->>'checkId' then raise exception 'Retry payload changed' using errcode='40001';end if;
   end if;
   results:=results||jsonb_build_array(to_jsonb(e));
  end loop;
  return jsonb_build_object('runId',r.id,'events',results);
 end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('runId','afterSequence','limit')) then raise exception 'Unknown read argument' using errcode='22023';end if;
 if (payload ? 'afterSequence' and coalesce(payload->>'afterSequence','') !~ '^\d{1,18}$') or (payload ? 'limit' and coalesce(payload->>'limit','') !~ '^\d{1,2}$') then raise exception 'Invalid cursor or limit' using errcode='22023';end if;
 cursor_seq:=coalesce((payload->>'afterSequence')::bigint,0);limit_count:=coalesce((payload->>'limit')::integer,20);
 if limit_count not between 1 and 20 then raise exception 'Read limit 1-20 required' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.sequence),'[]'),max(q.sequence) into results,next_seq from
  (select * from public.agent_audit_events where user_id=c.user_id and run_id=r.id and sequence>cursor_seq order by sequence limit limit_count) q;
 return jsonb_build_object('run',to_jsonb(r),'events',results,'nextSequence',coalesce(next_seq,cursor_seq),
  'hasMore',exists(select 1 from public.agent_audit_events where user_id=c.user_id and run_id=r.id and sequence>coalesce(next_seq,cursor_seq)));
end $$;
revoke all on function public.agent_audit_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_audit_dispatch(text,text,jsonb) to service_role;

commit;
