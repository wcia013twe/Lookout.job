begin;
-- Persisted identity reads let an approved discovery worker resume without
-- duplicating earlier normalized postings. Existing leases/scopes/run binding
-- still fence every read and write. No client or MCP operation is added.
create or replace function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
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
    perform private.backend_close_run(j,'cancelled','Execution permission or profile unavailable; previously saved evidence is retained.');
    update private.backend_jobs set status='cancelled',version=version+1,lease_token=null,lease_expires_at=null,finished_at=now(),updated_at=now(),result='{"error":"Execution permission or profile unavailable"}' where id=j.id;
    continue;
   end;
   if j.attempts>=3 then
    perform private.backend_close_run(j,'partial','Backend retry limit reached; previously saved evidence is retained.');
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
  if op is null or op not in ('search.run.start','search.run.read','search.context','search.progress','search.discoveries.save','search.discoveries.read','search.run.finish') then raise exception 'Unsupported execution operation' using errcode='22023';end if;
  if op in ('search.context','search.run.start') then
   if args->>'profileId' is distinct from j.input->>'profileId' then raise exception 'Execution profile mismatch' using errcode='42501';end if;
   if op='search.run.start' and args->>'eventKey' is distinct from 'job:'||j.id::text||':start' then raise exception 'Stable backend start event required' using errcode='22023';end if;
  elsif j.search_run_id is null or args->>'runId' is distinct from j.search_run_id::text then raise exception 'Execution run mismatch' using errcode='42501';end if;
  if op not in ('search.context','search.run.read','search.discoveries.read') and (coalesce(args->>'eventKey','') not like 'job:'||j.id::text||':%') then raise exception 'Backend event key required' using errcode='22023';end if;
  if op='search.discoveries.read' and (
   exists(select 1 from jsonb_object_keys(args) k where k not in ('runId','offset','limit'))
   or not args ?& array['runId','offset','limit']
   or jsonb_typeof(args->'offset') is distinct from 'number' or coalesce(args->>'offset','') !~ '^[0-9]{1,5}$' or (args->>'offset')::integer>5000
   or jsonb_typeof(args->'limit') is distinct from 'number' or coalesce(args->>'limit','') !~ '^[0-9]{1,3}$' or (args->>'limit')::integer not between 1 and 100
  ) then raise exception 'Bounded run discovery page required' using errcode='22023';end if;
  response:=public.agent_dispatch(c.token_hash,op,args);
  if op='search.discoveries.read' then
   -- Return only identity fields for this pinned run, never candidate context,
   -- application metadata, archived descriptions or screening contents.
   response:=jsonb_build_object('listings',coalesce((select jsonb_agg(jsonb_build_object('url',x->>'canonical_url','company',x->>'company','title',x->>'title','location',x->'location')) from jsonb_array_elements(response->'listings') x),'[]'::jsonb),'nextOffset',response->'nextOffset');
  end if;
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
  if payload->>'status' in ('failed','partial') then perform private.backend_close_run(j,'partial','Backend execution ended without exhaustive coverage; previously saved evidence is retained.');end if;
  if payload->>'status'='completed' and exists(select 1 from public.search_runs where id=j.search_run_id and user_id=j.user_id and state='active') then raise exception 'Finish search run before completing backend job' using errcode='22023';end if;
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
commit;
