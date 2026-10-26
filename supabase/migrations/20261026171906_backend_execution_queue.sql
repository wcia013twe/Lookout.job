begin;
-- Private execution infrastructure, separate from agent-authored tasks and approvals.
create table private.backend_schedules (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 connection_id uuid not null references private.agent_connections on delete cascade,
 kind text not null check(kind='search_ats'),input jsonb not null,interval_minutes integer not null check(interval_minutes between 15 and 10080),
 enabled boolean not null,version integer not null default 1 check(version>0),next_run_at timestamptz not null,
 last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,id)
);
create table private.backend_jobs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 connection_id uuid not null references private.agent_connections on delete cascade,schedule_id uuid references private.backend_schedules on delete set null,
 kind text not null check(kind='search_ats'),input jsonb not null,status text not null default 'queued' check(status in ('queued','running','completed','partial','failed','cancelled')),
 version integer not null default 1 check(version>0),attempts integer not null default 0 check(attempts between 0 and 3),
 result jsonb not null default '{}',search_run_id uuid references public.search_runs on delete set null,lease_token uuid,lease_expires_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),finished_at timestamptz,
 unique(user_id,id)
);
create table private.backend_requests (
 user_id uuid not null references auth.users on delete cascade,event_key text not null,operation text not null,payload jsonb not null,response jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,event_key)
);
create index backend_jobs_ready on private.backend_jobs(status,created_at) where status in ('queued','running');
create index backend_schedules_due on private.backend_schedules(next_run_at) where enabled;
do $$ declare t text;begin foreach t in array array['backend_jobs','backend_schedules','backend_requests'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('grant all on private.%I to service_role',t);
end loop;end $$;

create function private.backend_public_job(j private.backend_jobs) returns jsonb language sql immutable set search_path='' as $$
 select to_jsonb(j)-array['lease_token','lease_expires_at'];
$$;
create function private.backend_connection(owner_id uuid,connection_id uuid,write_access boolean) returns private.agent_connections
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 select * into c from private.agent_connections where id=connection_id and user_id=owner_id and revoked_at is null and expires_at>now() for share;
 if not found or not ('workspace:read'=any(c.scopes)) or (write_access and not (c.scopes @> array['preferences:write','drafts:write'])) then
 raise exception 'Active scoped execution connection required' using errcode='42501';end if;
 return c;
end $$;
create function private.backend_input(owner_id uuid,kind text,input jsonb) returns void language plpgsql set search_path='' as $$
#variable_conflict use_variable
begin
 if kind is distinct from 'search_ats' or jsonb_typeof(input) is distinct from 'object' or input->>'profileId' is null
 or jsonb_typeof(input->'profileId') is distinct from 'string' or input->>'profileId' !~ '^[a-zA-Z0-9_-]{1,80}$' or exists(select 1 from jsonb_object_keys(input) k where k<>'profileId') then
 raise exception 'Invalid backend job input' using errcode='22023';end if;
 if not exists(select 1 from public.search_documents d where d.user_id=owner_id and d.kind='profile' and d.id=input->>'profileId' and d.projection->>'active'='true') then
 raise exception 'Active owned search profile required' using errcode='22023';end if;
end $$;
create function private.backend_action(owner_id uuid,bound_connection uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;s private.backend_schedules;r private.backend_requests;response jsonb;key text;conn uuid;wanted uuid;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>16000 then raise exception 'Invalid backend payload' using errcode='22023';end if;
 if operation='backend.jobs.read' then
  if exists(select 1 from jsonb_object_keys(payload) k where k<>'jobId') then raise exception 'Unknown backend payload field' using errcode='22023';end if;
  wanted:=nullif(payload->>'jobId','')::uuid;
  select jsonb_build_object('jobs',coalesce(jsonb_agg(private.backend_public_job(x) order by x.created_at desc),'[]')) into response from
  (select * from private.backend_jobs where user_id=owner_id and (wanted is null or id=wanted) order by created_at desc limit 100) x;
  return response;
 elsif operation='backend.schedules.read' then
  if payload<>'{}' then raise exception 'Unknown backend payload field' using errcode='22023';end if;
  return jsonb_build_object('schedules',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from (select * from private.backend_schedules where user_id=owner_id order by created_at desc limit 100) x),'[]'));
 elsif operation='backend.jobs.cancel' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('jobId','expectedVersion')) or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' or (payload->>'expectedVersion')::integer<1 then raise exception 'Invalid cancel payload' using errcode='22023';end if;
  select * into j from private.backend_jobs where user_id=owner_id and id=(payload->>'jobId')::uuid for update;
  if not found then raise exception 'Owned backend job not found' using errcode='P0002';end if;
  if j.version<>(payload->>'expectedVersion')::integer then raise exception 'Backend job changed' using errcode='40001';end if;
  if j.status not in ('queued','running') then raise exception 'Backend job is already finished' using errcode='22023';end if;
  update private.backend_jobs set status='cancelled',version=version+1,lease_token=null,lease_expires_at=null,updated_at=now(),finished_at=now() where id=j.id returning * into j;
  return private.backend_public_job(j);
 elsif operation not in ('backend.jobs.submit','backend.schedules.save') then raise exception 'Unknown backend operation' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('kind','input','eventKey','connectionId','id','intervalMinutes','enabled','expectedVersion'))
 or (operation='backend.jobs.submit' and payload ?| array['id','intervalMinutes','enabled','expectedVersion']) then raise exception 'Unknown backend payload field' using errcode='22023';end if;
 if bound_connection is not null and payload ? 'connectionId' then raise exception 'Agent connection binding is server controlled' using errcode='22023';end if;
 conn:=coalesce(bound_connection,(payload->>'connectionId')::uuid);
 perform private.backend_connection(owner_id,conn,true);
 key:=payload->>'eventKey';
 if jsonb_typeof(payload->'eventKey') is distinct from 'string' or key is null or length(key) not between 1 and 160 or length(trim(key))=0 or key ~ '[[:cntrl:]]' then raise exception 'Valid event key required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,98));
 select * into r from private.backend_requests where user_id=owner_id and event_key=key;
 if found then
  if r.operation<>operation or r.payload<>(payload||jsonb_build_object('_boundConnection',conn)) then raise exception 'Event key payload changed' using errcode='22023';end if;
  return r.response;
 end if;
 perform private.backend_input(owner_id,payload->>'kind',payload->'input');
 if operation='backend.jobs.submit' then
  if (select count(*) from private.backend_jobs where user_id=owner_id and status in ('queued','running'))>=100 then raise exception 'Backend queue limit reached' using errcode='22023';end if;
  insert into private.backend_jobs(user_id,connection_id,kind,input) values(owner_id,conn,payload->>'kind',payload->'input') returning * into j;
  response:=private.backend_public_job(j);
 else
  if jsonb_typeof(payload->'enabled') is distinct from 'boolean' or jsonb_typeof(payload->'intervalMinutes') is distinct from 'number' or coalesce(payload->>'intervalMinutes','') !~ '^[0-9]{1,5}$' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' or payload->>'intervalMinutes' is null or (payload->>'intervalMinutes')::integer not between 15 and 10080 or payload->>'expectedVersion' is null then raise exception 'Invalid backend schedule' using errcode='22023';end if;
  if payload ? 'id' then
   select * into s from private.backend_schedules where user_id=owner_id and id=(payload->>'id')::uuid for update;
   if not found then raise exception 'Owned backend schedule not found' using errcode='P0002';end if;
   if (payload->>'expectedVersion')::integer<1 or s.version<>(payload->>'expectedVersion')::integer then raise exception 'Backend schedule changed' using errcode='40001';end if;
   update private.backend_schedules set connection_id=conn,kind=payload->>'kind',input=payload->'input',interval_minutes=(payload->>'intervalMinutes')::integer,enabled=(payload->>'enabled')::boolean,version=version+1,next_run_at=now()+make_interval(mins=>(payload->>'intervalMinutes')::integer),last_error=null,updated_at=now() where id=s.id returning * into s;
  else
   if (payload->>'expectedVersion')::integer<>0 then raise exception 'Backend schedule changed' using errcode='40001';end if;
   if (select count(*) from private.backend_schedules where user_id=owner_id)>=20 then raise exception 'Backend schedule limit reached' using errcode='22023';end if;
   insert into private.backend_schedules(user_id,connection_id,kind,input,interval_minutes,enabled,next_run_at) values(owner_id,conn,payload->>'kind',payload->'input',(payload->>'intervalMinutes')::integer,(payload->>'enabled')::boolean,now()+make_interval(mins=>(payload->>'intervalMinutes')::integer)) returning * into s;
  end if;
  response:=to_jsonb(s);
 end if;
 insert into private.backend_requests(user_id,event_key,operation,payload,response) values(owner_id,key,operation,payload||jsonb_build_object('_boundConnection',conn),response);
 return response;
end $$;

create function private.backend_job_authenticated(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 return private.backend_action(auth.uid(),null,operation,payload);
end $$;
create function public.backend_job_action(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$
 select private.backend_job_authenticated(operation,payload);
$$;
create function public.backend_job_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid agent credential' using errcode='42501';end if;
 perform private.backend_connection(c.user_id,c.id,operation not in ('backend.jobs.read','backend.schedules.read'));
 return private.backend_action(c.user_id,c.id,operation,payload);
end $$;

create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;s private.backend_schedules;c private.agent_connections;n integer:=0;op text;args jsonb;response jsonb;
begin
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>64000 then raise exception 'Invalid worker payload' using errcode='22023';end if;
 if operation='claim' then
  if payload<>'{}' then raise exception 'Invalid claim payload' using errcode='22023';end if;
  for j in select * from private.backend_jobs where status='queued' or (status='running' and lease_expires_at<=now()) order by created_at for update skip locked limit 100 loop
   begin
    c:=private.backend_connection(j.user_id,j.connection_id,true);
    perform private.backend_input(j.user_id,j.kind,j.input);
   exception when sqlstate '42501' or sqlstate '22023' then
    update private.backend_jobs set status='cancelled',version=version+1,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now(),result='{"error":"Execution permission or profile unavailable"}' where id=j.id;
    continue;
   end;
   if j.attempts>=3 then
    update private.backend_jobs set status='failed',version=version+1,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now(),result='{"error":"Execution retry limit reached"}' where id=j.id;
    continue;
   end if;
   update private.backend_jobs set status='running',attempts=attempts+1,version=version+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',updated_at=now() where id=j.id returning * into j;
   return jsonb_build_object('job',private.backend_public_job(j),'credentialHash',c.token_hash,'leaseToken',j.lease_token);
  end loop;
  return null;
 elsif operation='dispatch' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('jobId','leaseToken','expectedVersion','operation','payload')) or jsonb_typeof(payload->'payload') is distinct from 'object' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' then raise exception 'Invalid dispatch payload' using errcode='22023';end if;
  select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid for update;
  if not found then raise exception 'Backend job not found' using errcode='P0002';end if;
  if j.status<>'running' or j.lease_token is distinct from (payload->>'leaseToken')::uuid or j.lease_expires_at<=now() or j.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Backend lease changed' using errcode='40001';end if;
  c:=private.backend_connection(j.user_id,j.connection_id,true);
  perform private.backend_input(j.user_id,j.kind,j.input);
  op:=payload->>'operation';args:=payload->'payload';
  if op is null or op not in ('search.run.start','search.run.read','search.context','search.progress','search.discoveries.save','search.run.finish') then raise exception 'Unsupported execution operation' using errcode='22023';end if;
  if op in ('search.context','search.run.start') then
   if args->>'profileId' is distinct from j.input->>'profileId' then raise exception 'Execution profile mismatch' using errcode='42501';end if;
   if op='search.run.start' and args->>'eventKey' is distinct from 'job:'||j.id::text||':start' then raise exception 'Stable backend start event required' using errcode='22023';end if;
  elsif j.search_run_id is null or args->>'runId' is distinct from j.search_run_id::text then raise exception 'Execution run mismatch' using errcode='42501';end if;
  if op not in ('search.context','search.run.read') and (coalesce(args->>'eventKey','') not like 'job:'||j.id::text||':%') then raise exception 'Backend event key required' using errcode='22023';end if;
  response:=public.agent_dispatch(c.token_hash,op,args);
  if op='search.run.start' then
   if j.search_run_id is not null and j.search_run_id is distinct from (response->>'id')::uuid then raise exception 'Execution run changed' using errcode='40001';end if;
   update private.backend_jobs set search_run_id=(response->>'id')::uuid where id=j.id;
  end if;
  return response;
 elsif operation='finish' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('jobId','leaseToken','expectedVersion','status','result')) or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' or payload->>'status' not in ('completed','partial','failed') or payload->>'status' is null or jsonb_typeof(payload->'result') is distinct from 'object' or octet_length((payload->'result')::text)>32000 then raise exception 'Invalid finish payload' using errcode='22023';end if;
  select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid for update;
  if not found then raise exception 'Backend job not found' using errcode='P0002';end if;
  if j.status<>'running' or j.lease_token is distinct from (payload->>'leaseToken')::uuid or j.lease_expires_at<=now() or j.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Backend lease changed' using errcode='40001';end if;
  perform private.backend_connection(j.user_id,j.connection_id,true);
  update private.backend_jobs set status=payload->>'status',result=payload->'result',version=version+1,lease_token=null,lease_expires_at=null,updated_at=now(),finished_at=now() where id=j.id returning * into j;
  return private.backend_public_job(j);
 elsif operation='enqueue_due' then
  if payload<>'{}' then raise exception 'Invalid schedule tick payload' using errcode='22023';end if;
  for s in select * from private.backend_schedules where enabled and next_run_at<=now() order by next_run_at for update skip locked limit 100 loop
   begin
    perform private.backend_connection(s.user_id,s.connection_id,true);
    perform private.backend_input(s.user_id,s.kind,s.input);
   exception when sqlstate '42501' or sqlstate '22023' then
    update private.backend_schedules set enabled=false,version=version+1,last_error='Execution permission or profile unavailable',updated_at=now() where id=s.id;
    continue;
   end;
   if not pg_try_advisory_xact_lock(hashtextextended(s.user_id::text,98)) then continue;end if;
   if (select count(*) from private.backend_jobs where user_id=s.user_id and status in ('queued','running'))<100 and not exists(select 1 from private.backend_jobs where schedule_id=s.id and status in ('queued','running')) then
    insert into private.backend_jobs(user_id,connection_id,schedule_id,kind,input) values(s.user_id,s.connection_id,s.id,s.kind,s.input);
    n:=n+1;
   end if;
   update private.backend_schedules set next_run_at=now()+make_interval(mins=>s.interval_minutes),updated_at=now() where id=s.id;
  end loop;
  return jsonb_build_object('enqueued',n);
 end if;
 raise exception 'Unknown worker operation' using errcode='22023';
end $$;

revoke all on function private.backend_public_job(private.backend_jobs),private.backend_connection(uuid,uuid,boolean),private.backend_input(uuid,text,jsonb),private.backend_action(uuid,uuid,text,jsonb),private.backend_job_authenticated(text,jsonb) from public,anon,authenticated;
grant execute on function private.backend_job_authenticated(text,jsonb) to authenticated;
revoke all on function public.backend_job_action(text,jsonb) from public,anon;
grant execute on function public.backend_job_action(text,jsonb) to authenticated;
revoke all on function public.backend_job_dispatch(text,text,jsonb),public.backend_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_job_dispatch(text,text,jsonb),public.backend_worker(text,jsonb) to service_role;
-- Reset previews and finalization include execution state, and pending resets
-- reject new work, reclaimed leases, and schedule ticks through the same guard.
alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_backend;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['private.backend_jobs','private.backend_schedules','private.backend_requests']||private.workspace_reset_tables_before_backend();
$$;
revoke all on function private.workspace_reset_tables() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on private.backend_jobs for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on private.backend_schedules for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on private.backend_requests for each row execute function private.workspace_reset_write_guard();
commit;
