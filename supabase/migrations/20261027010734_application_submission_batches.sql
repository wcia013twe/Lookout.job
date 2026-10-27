-- Bounded submission execution journals, separate from search schedules.
-- They store references/outcomes, never credentials, browser state or approvals.
create table private.submission_batches (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 connection_id uuid not null references private.agent_connections on delete cascade,
 event_key text not null,input jsonb not null,results jsonb not null default '{}',
 status text not null default 'running' check(status in ('running','completed','partial')),
 version integer not null default 1,lease_token uuid,lease_expires_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(user_id,event_key)
);
alter table private.submission_batches enable row level security;
revoke all on private.submission_batches from public,anon,authenticated;
grant all on private.submission_batches to service_role;
create function private.submission_batch_public(b private.submission_batches) returns jsonb language sql immutable set search_path='' as $$
 select to_jsonb(b)-array['lease_token','lease_expires_at'];
$$;
revoke all on function private.submission_batch_public(private.submission_batches) from public,anon,authenticated;

create function private.read_submission_batches(owner_id uuid,payload jsonb) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['batchId']<>'{}' then raise exception 'Unknown batch argument' using errcode='22023';end if;
 return jsonb_build_object('batches',coalesce((select jsonb_agg(private.submission_batch_public(x) order by x.created_at desc,x.id) from
  (select * from private.submission_batches where user_id=owner_id and (not payload ? 'batchId' or id=(payload->>'batchId')::uuid) order by created_at desc,id limit 100) x),'[]'));
end $$;
revoke all on function private.read_submission_batches(uuid,jsonb) from public,anon,authenticated;
create function public.read_submission_batches(payload jsonb default '{}') returns jsonb language sql stable security definer set search_path='' as $$
 select private.read_submission_batches(auth.uid(),payload);
$$;
revoke all on function public.read_submission_batches(jsonb) from public,anon;
grant execute on function public.read_submission_batches(jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_submission_batches;
alter function public.agent_dispatch_before_submission_batches(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_submission_batches(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.agent_dispatch_before_submission_batches(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;b private.submission_batches;item jsonb;a public.applications;t public.submission_attempts;key text;state text;result jsonb;attempt_key text;
begin
 if operation not like 'submission.batch.%' then return private.agent_dispatch_before_submission_batches(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_submission_batches(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) or (operation<>'submission.batch.read' and not c.scopes @> array['drafts:write','approvals:read','resumes:read']) then raise exception 'Submission scopes required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>16000 then raise exception 'Invalid batch payload' using errcode='22023';end if;
 if operation='submission.batch.read' then
  return private.read_submission_batches(c.user_id,payload);
 elsif operation='submission.batch.begin' then
  if payload-array['eventKey','applications']<>'{}' or jsonb_typeof(payload->'applications') is distinct from 'array' or jsonb_array_length(payload->'applications') not between 1 and 10
   or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(payload->>'eventKey')) not between 1 and 160 or payload->>'eventKey' ~ '[[:cntrl:]]' then raise exception 'Bounded application batch and stable eventKey required' using errcode='22023';end if;
  if (select count(distinct (value->>'applicationId')::uuid) from jsonb_array_elements(payload->'applications'))<>jsonb_array_length(payload->'applications') then raise exception 'Duplicate applications' using errcode='22023';end if;
  -- Serialize creation/replay without holding a transaction open during browser work.
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,109));
  select * into b from private.submission_batches where user_id=c.user_id and event_key=payload->>'eventKey' for update;
  if found then
   if b.input<>payload->'applications' or b.connection_id<>c.id then raise exception 'Batch retry changed' using errcode='40001';end if;
   if b.status<>'running' or b.lease_expires_at>now() then return jsonb_build_object('batch',private.submission_batch_public(b),'acquired',false);end if;
  else
   for item in select value from jsonb_array_elements(payload->'applications') loop
    if jsonb_typeof(item) is distinct from 'object' or item-array['applicationId','expectedRevision']<>'{}'
     or coalesce(item->>'expectedRevision','') !~ '^[0-9]{1,9}$' or jsonb_typeof(item->'expectedRevision') is distinct from 'number' then raise exception 'Versioned application references required' using errcode='22023';end if;
    select * into a from public.applications where user_id=c.user_id and id=(item->>'applicationId')::uuid for share;
    if not found then raise exception 'Owned application required' using errcode='P0002';end if;
    if a.revision<>(item->>'expectedRevision')::integer then raise exception 'Draft changed before batching' using errcode='40001';end if;
   end loop;
   insert into private.submission_batches(user_id,connection_id,event_key,input) values(c.user_id,c.id,payload->>'eventKey',payload->'applications') returning * into b;
  end if;
  update private.submission_batches set lease_token=gen_random_uuid(),lease_expires_at=now()+interval '3 minutes',version=version+1,updated_at=now() where id=b.id returning * into b;
  return jsonb_build_object('batch',private.submission_batch_public(b),'acquired',true,'leaseToken',b.lease_token);
 elsif operation not in ('submission.batch.touch','submission.batch.checkpoint') then raise exception 'Unknown batch operation' using errcode='22023';end if;
 if payload-array['batchId','leaseToken','expectedVersion','applicationId']<>'{}' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' then raise exception 'Versioned batch lease required' using errcode='22023';end if;
 select * into b from private.submission_batches where id=(payload->>'batchId')::uuid and user_id=c.user_id and connection_id=c.id for update;
 if not found then raise exception 'Owned batch connection required' using errcode='P0002';end if;
 if b.status<>'running' or b.version is distinct from (payload->>'expectedVersion')::integer or b.lease_token is distinct from (payload->>'leaseToken')::uuid or b.lease_expires_at<=now() then raise exception 'Batch lease changed' using errcode='40001';end if;
 select value into item from jsonb_array_elements(b.input) where value->>'applicationId'=payload->>'applicationId';
 if item is null then raise exception 'Application outside batch' using errcode='42501';end if;
 if operation='submission.batch.checkpoint' then
  select * into a from public.applications where id=(item->>'applicationId')::uuid and user_id=c.user_id;
  attempt_key:='batch_'||md5(b.id::text||':'||a.id::text);
  select * into t from public.submission_attempts where user_id=c.user_id and application_id=a.id and submission_attempts.attempt_key=attempt_key;
  -- Derive checkpoint outcomes from persisted domain state, never caller claims.
  state:=case when t.state='confirmed' then 'Submitted' when t.state in ('started','uncertain','claimed') then 'Needs you'
   when a.status in ('Submitted','Interview','Offer') then 'Already submitted' when a.status in ('Blocked','Awaiting approval','Rejected','Withdrawn') then 'Needs you' else 'Not submitted' end;
  result:=jsonb_build_object('applicationId',a.id,'status',state,'attemptState',t.state,'revision',a.revision,'reason',coalesce(a.blocker,''));
  update private.submission_batches set results=jsonb_set(results,array[a.id::text],result) where id=b.id returning * into b;
  if (select count(*) from jsonb_object_keys(b.results))=jsonb_array_length(b.input) then
   update private.submission_batches set status=case when not exists(select 1 from jsonb_each(b.results) r where r.value->>'status' not in ('Submitted','Already submitted')) then 'completed' else 'partial' end where id=b.id returning * into b;
  end if;
 end if;
 update private.submission_batches set version=version+1,lease_expires_at=case when status='running' then now()+interval '3 minutes' end,lease_token=case when status='running' then lease_token end,updated_at=now() where id=b.id returning * into b;
 return private.submission_batch_public(b);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_submission_batches;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['private.submission_batches']||private.workspace_reset_tables_before_submission_batches();
$$;
revoke all on function private.workspace_reset_tables() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on private.submission_batches for each row execute function private.workspace_reset_write_guard();
