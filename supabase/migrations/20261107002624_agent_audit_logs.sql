begin;
-- Collection only: agent observations are not grades, approvals or verified receipts.
create table public.agent_audit_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null,
 event_key text not null check(length(btrim(event_key)) between 1 and 200),
 task text not null check(length(btrim(task)) between 1 and 10000),
 area text not null check(area in ('discover','applications','network','toolkit','setup','other')),
 mode text not null check(mode in ('live','controlled')),
 metadata jsonb not null default '{}' check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=128000),
 recorded_at timestamptz not null default clock_timestamp(),
 unique(user_id,event_key), unique(user_id,id)
);
create table public.agent_audit_events (
 sequence bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 run_id uuid not null,
 connection_id uuid not null,
 event_key text not null check(length(btrim(event_key)) between 1 and 200),
 kind text not null check(kind ~ '^[a-z][a-z0-9_.-]{0,79}$'),
 summary text not null default '' check(length(summary)<=4000),
 tool_name text check(length(tool_name) between 1 and 160),
 occurred_at timestamptz,
 data jsonb not null default '{}' check(jsonb_typeof(data)='object' and octet_length(data::text)<=128000),
 recorded_at timestamptz not null default clock_timestamp(),
 foreign key(user_id,run_id) references public.agent_audit_runs(user_id,id) on delete cascade,
 unique(run_id,event_key)
);
create index agent_audit_runs_owner_date on public.agent_audit_runs(user_id,recorded_at desc,id);
create index agent_audit_events_run_sequence on public.agent_audit_events(user_id,run_id,sequence);
alter table public.agent_audit_runs enable row level security;
alter table public.agent_audit_events enable row level security;
create policy audit_runs_owner_read on public.agent_audit_runs for select to authenticated using(user_id=(select auth.uid()));
create policy audit_events_owner_read on public.agent_audit_events for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.agent_audit_runs,public.agent_audit_events from public,anon,authenticated,service_role;
grant select on public.agent_audit_runs,public.agent_audit_events to authenticated;
grant select,insert on public.agent_audit_runs,public.agent_audit_events to service_role;
revoke all on sequence public.agent_audit_events_sequence_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.agent_audit_events_sequence_seq to service_role;
comment on table public.agent_audit_runs is 'Private immutable run metadata. Agent-reported collection only; not independent verification. Connection UUID retained even after connection removal.';
comment on table public.agent_audit_events is 'Append-only for API roles. Server sequence/time and credential identity are authoritative; client data, occurred_at and outcome claims are observations, never approval or submission authority.';

-- Reject common accidental secret fields/values. Callers must still redact free text.
create function private.audit_payload_safe(document jsonb) returns boolean
language sql immutable set search_path='' as $$
 with recursive nodes(key,value) as (
  select ''::text,document
  union all
  select child.key,child.value from nodes n cross join lateral (
   select e.key,e.value from jsonb_each(case when jsonb_typeof(n.value)='object' then n.value else '{}' end) e
   union all
   select '',a.value from jsonb_array_elements(case when jsonb_typeof(n.value)='array' then n.value else '[]' end) a
  ) child
 )
 select not exists(select 1 from nodes where
  lower(replace(key,'_','')) in ('authorization','credential','credentialhash','apikey','accesstoken','refreshtoken','servicerolekey','signedurl','signedurls','password','secret','tokenhash')
  or (jsonb_typeof(value)='string' and value::text ~* '(jb_agent_[a-f0-9]{64}|Bearer [A-Za-z0-9._-]+|/storage/v1/object/sign/|[?&]token=)'))
$$;
revoke all on function private.audit_payload_safe(jsonb) from public,anon,authenticated;
grant execute on function private.audit_payload_safe(jsonb) to service_role;

create function public.agent_audit_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
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
   or coalesce(payload->>'area','') not in ('discover','applications','network','toolkit','setup','other')
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
   if exists(select 1 from jsonb_object_keys(item) k where k not in ('eventKey','kind','summary','toolName','occurredAt','data'))
    or length(btrim(coalesce(item->>'eventKey',''))) not between 1 and 200
    or coalesce(item->>'kind','') !~ '^[a-z][a-z0-9_.-]{0,79}$'
    or (item ? 'summary' and jsonb_typeof(item->'summary') is distinct from 'string') or length(coalesce(item->>'summary',''))>4000
    or (item ? 'toolName' and (jsonb_typeof(item->'toolName') is distinct from 'string' or length(item->>'toolName') not between 1 and 160))
    or (item->>'occurredAt' is not null and (jsonb_typeof(item->'occurredAt') is distinct from 'string' or item->>'occurredAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' or not isfinite((item->>'occurredAt')::timestamptz)))
    or jsonb_typeof(coalesce(item->'data','{}')) is distinct from 'object' or octet_length(coalesce(item->'data','{}')::text)>128000
    then raise exception 'Invalid audit event' using errcode='22023';end if;
   insert into public.agent_audit_events(user_id,run_id,connection_id,event_key,kind,summary,tool_name,occurred_at,data)
    values(c.user_id,r.id,c.id,item->>'eventKey',item->>'kind',coalesce(item->>'summary',''),item->>'toolName',(item->>'occurredAt')::timestamptz,coalesce(item->'data','{}'))
    on conflict(run_id,event_key) do nothing returning * into e;
   if e.sequence is null then
    select * into e from public.agent_audit_events where run_id=r.id and event_key=item->>'eventKey';
    if e.kind is distinct from item->>'kind' or e.summary<>coalesce(item->>'summary','') or e.tool_name is distinct from item->>'toolName' or e.occurred_at is distinct from (item->>'occurredAt')::timestamptz or e.data<>coalesce(item->'data','{}') then raise exception 'Retry payload changed' using errcode='40001';end if;
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
-- Include logs in the existing user-requested workspace reset and write fence.
alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_audit;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['public.agent_audit_events','public.agent_audit_runs']::text[] || private.workspace_reset_tables_before_audit()
$$;
revoke all on function private.workspace_reset_tables() from public,anon,authenticated;
revoke all on function private.workspace_reset_tables_before_audit() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on public.agent_audit_runs for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on public.agent_audit_events for each row execute function private.workspace_reset_write_guard();
commit;
