begin;
-- Retire recurring backend searches. Preserve configuration as non-executable
-- owned history in the existing request ledger, never as a second schedule.
lock table private.backend_schedules in access exclusive mode;
insert into private.backend_requests(user_id,event_key,operation,payload,response)
 select user_id,'retired-backend-schedule:'||id::text||':'||gen_random_uuid()::text,'backend.schedules.retired','{}',to_jsonb(s)
 from private.backend_schedules s;

create or replace function private.backend_action(owner_id uuid,bound_connection uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;r private.backend_requests;response jsonb;key text;conn uuid;wanted uuid;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>16000 then raise exception 'Invalid backend payload' using errcode='22023';end if;
 if operation='backend.jobs.read' then
  if exists(select 1 from jsonb_object_keys(payload) k where k<>'jobId') then raise exception 'Unknown backend payload field' using errcode='22023';end if;
  wanted:=nullif(payload->>'jobId','')::uuid;
  select jsonb_build_object('jobs',coalesce(jsonb_agg(private.backend_public_job(x) order by x.created_at desc),'[]')) into response from
  (select * from private.backend_jobs where user_id=owner_id and (wanted is null or id=wanted) order by created_at desc limit 100) x;
  return response;
 elsif operation='backend.jobs.cancel' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('jobId','expectedVersion')) or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' or (payload->>'expectedVersion')::integer<1 then raise exception 'Invalid cancel payload' using errcode='22023';end if;
  select * into j from private.backend_jobs where user_id=owner_id and id=(payload->>'jobId')::uuid for update;
  if not found then raise exception 'Owned backend job not found' using errcode='P0002';end if;
  if j.version<>(payload->>'expectedVersion')::integer then raise exception 'Backend job changed' using errcode='40001';end if;
  if j.status not in ('queued','running') then raise exception 'Backend job is already finished' using errcode='22023';end if;
  perform private.backend_close_run(j,'cancelled','Backend job cancelled; previously saved evidence is retained.');
  update private.backend_jobs set status='cancelled',version=version+1,lease_token=null,lease_expires_at=null,updated_at=now(),finished_at=now() where id=j.id returning * into j;
  return private.backend_public_job(j);
 elsif operation<>'backend.jobs.submit' then raise exception 'Unknown backend operation' using errcode='22023';end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('kind','input','eventKey','connectionId')) then raise exception 'Unknown backend payload field' using errcode='22023';end if;
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
  if (select count(*) from private.backend_jobs where user_id=owner_id and status in ('queued','running'))>=100 then raise exception 'Backend queue limit reached' using errcode='22023';end if;
  insert into private.backend_jobs(user_id,connection_id,kind,input) values(owner_id,conn,payload->>'kind',payload->'input') returning * into j;
  response:=private.backend_public_job(j);
 insert into private.backend_requests(user_id,event_key,operation,payload,response) values(owner_id,key,operation,payload||jsonb_build_object('_boundConnection',conn),response);
 return response;
end $$;

create or replace function public.backend_job_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid agent credential' using errcode='42501';end if;
 perform private.backend_connection(c.user_id,c.id,operation<>'backend.jobs.read');
 return private.backend_action(c.user_id,c.id,operation,payload);
end $$;

do $migration$
declare definition text;start_at integer;end_at integer;
begin
 definition:=pg_get_functiondef('public.backend_worker(text,jsonb)'::regprocedure);
 start_at:=strpos(definition,$marker$ elsif operation='enqueue_due' then$marker$);
 end_at:=strpos(definition,$marker$ raise exception 'Unknown worker operation'$marker$);
 if start_at=0 or end_at<=start_at then raise exception 'Expected backend scheduler branch unavailable';end if;
 definition:=substring(definition from 1 for start_at-1)||E' end if;\n'||substring(definition from end_at);
 definition:=replace(definition,'s private.backend_schedules;','');
 definition:=replace(definition,'n integer:=0;','');
 if strpos(definition,'backend_schedules')>0 or strpos(definition,'enqueue_due')>0 then raise exception 'Backend scheduler references remain';end if;
 execute definition;
end $migration$;

-- Retain old job origin IDs as history, without a scheduler table or FK.
alter table private.backend_jobs drop constraint backend_jobs_schedule_id_fkey;
drop table private.backend_schedules;
alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_scheduler_retirement;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array_remove(private.workspace_reset_tables_before_scheduler_retirement(),'private.backend_schedules');
$$;
revoke all on function private.workspace_reset_tables(),private.workspace_reset_tables_before_scheduler_retirement() from public,anon,authenticated;
commit;
