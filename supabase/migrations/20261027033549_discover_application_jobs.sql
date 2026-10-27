begin;
alter table private.backend_jobs drop constraint backend_jobs_kind_check;
alter table private.backend_jobs add constraint backend_jobs_kind_check check(kind in ('search_ats','application_submit'));
alter table public.applications add column execution_job jsonb;
-- Public state is a read projection; only trusted domain functions may write it.
create function private.protect_application_execution_job() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and (case when tg_op='INSERT' then new.execution_job is not null else new.execution_job is distinct from old.execution_job end) then raise exception 'Execution state is server controlled' using errcode='42501';end if;
 return new;
end $$;
create trigger application_execution_job_guard before insert or update on public.applications for each row execute function private.protect_application_execution_job();
create function private.project_application_job() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='application_submit' then
  update public.applications set execution_job=jsonb_build_object('id',new.id,'status',new.status,'result',new.result,'updatedAt',new.updated_at)
   where user_id=new.user_id and id=(new.input->>'applicationId')::uuid;
 end if;
 return new;
end $$;
create trigger application_job_projection after insert or update on private.backend_jobs for each row execute function private.project_application_job();
revoke all on function private.protect_application_execution_job(),private.project_application_job() from public,anon,authenticated;

alter function private.backend_input(uuid,text,jsonb) rename to backend_input_before_applications;
create function private.backend_input(owner_id uuid,kind text,input jsonb) returns void language plpgsql set search_path='' as $$
begin
 if kind<>'application_submit' then perform private.backend_input_before_applications(owner_id,kind,input);return;end if;
 if jsonb_typeof(input) is distinct from 'object' or input-array['applicationId','expectedRevision']<>'{}' or jsonb_typeof(input->'applicationId') is distinct from 'string' or jsonb_typeof(input->'expectedRevision') is distinct from 'number' or coalesce(input->>'expectedRevision','') !~ '^[0-9]{1,9}$' then raise exception 'Versioned application required' using errcode='22023';end if;
 if not exists(select 1 from public.applications where id=(input->>'applicationId')::uuid and user_id=owner_id) then raise exception 'Owned application not found' using errcode='22023';end if;
end $$;
revoke all on function private.backend_input(uuid,text,jsonb),private.backend_input_before_applications(uuid,text,jsonb) from public,anon,authenticated;

create function private.queue_application_job(owner_id uuid,bound_connection uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;a public.applications;j public.jobs;b private.backend_jobs;request private.backend_requests;p jsonb:=payload->'posting';key text:=payload->>'eventKey';response jsonb;profile_id text:=payload->>'profileId';
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['posting','profileId','expectedRevision','eventKey']<>'{}' or octet_length(payload::text)>6000
  or jsonb_typeof(p) is distinct from 'object' or p-array['id','url','company','title','employmentType','location']<>'{}'
  or jsonb_typeof(p->'id') is distinct from 'string' or length(trim(coalesce(p->>'id',''))) not between 1 and 200
  or jsonb_typeof(p->'company') is distinct from 'string' or length(trim(coalesce(p->>'company',''))) not between 1 and 200
  or jsonb_typeof(p->'title') is distinct from 'string' or length(trim(coalesce(p->>'title',''))) not between 1 and 200
  or jsonb_typeof(p->'location') is distinct from 'string' or length(p->>'location')>1000 or coalesce(p->>'employmentType','') not in ('FT','Internship')
  or jsonb_typeof(p->'url') is distinct from 'string' or length(p->>'url')>2048 or coalesce(p->>'url','') !~ '^https://(job-boards|boards)\.greenhouse\.io/[a-zA-Z0-9_-]+/jobs/[0-9]+$'
  or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or coalesce(payload->>'expectedRevision','') !~ '^[0-9]{1,9}$'
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(key,''))) not between 1 and 160 or length(key)>160 or key ~ '[[:cntrl:]]'
 then raise exception 'Invalid application job request' using errcode='22023';end if;
 if payload ? 'profileId' and (jsonb_typeof(payload->'profileId') is distinct from 'string' or profile_id !~ '^[a-zA-Z0-9_-]{1,80}$' or not exists(select 1 from public.search_documents where user_id=owner_id and kind='profile' and id=profile_id and projection->>'active'='true')) then raise exception 'Active owned profile required' using errcode='22023';end if;
 select * into c from private.agent_connections where user_id=owner_id and (bound_connection is null or id=bound_connection) and revoked_at is null and expires_at>now() and scopes @> array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'] order by created_at desc,id limit 1 for share;
 if not found then raise exception 'Connect an active agent with application execution scopes' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,98));
 select * into request from private.backend_requests where user_id=owner_id and event_key=key;
 if found then
  if request.operation<>'applications.submit_job' or request.payload<>payload then raise exception 'Retry key changed' using errcode='40001';end if;
  return request.response;
 end if;
 select * into j from public.jobs where canonical_url=p->>'url';
 if not found then
  insert into public.jobs(id,canonical_url,employer) values(p->>'id',p->>'url',jsonb_build_object('company',p->>'company','title',p->>'title','employmentType',p->>'employmentType','location',p->>'location')) on conflict do nothing;
  select * into j from public.jobs where canonical_url=p->>'url';
  if not found then raise exception 'Catalog identity changed' using errcode='40001';end if;
 end if;
 insert into public.applications(user_id,job_id,draft) values(owner_id,j.id,jsonb_strip_nulls(jsonb_build_object('url',j.canonical_url,'searchProfileId',profile_id))) on conflict(user_id,job_id) do nothing;
 select * into a from public.applications where user_id=owner_id and job_id=j.id for update;
 if a.revision<>(payload->>'expectedRevision')::integer then raise exception 'Application changed; reload before queueing' using errcode='40001';end if;
 if profile_id is not null and a.draft->>'searchProfileId' is distinct from profile_id then raise exception 'Application is bound to another profile; reconcile its draft first' using errcode='40001';end if;
 if a.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Application is already past drafting' using errcode='22023';end if;
 select * into b from private.backend_jobs where user_id=owner_id and kind='application_submit' and input->>'applicationId'=a.id::text and status in ('queued','running') order by created_at desc limit 1;
 if not found then
  if (select count(*) from private.backend_jobs where user_id=owner_id and status in ('queued','running'))>=100 then raise exception 'Queue limit reached' using errcode='22023';end if;
  insert into private.backend_jobs(user_id,connection_id,kind,input) values(owner_id,c.id,'application_submit',jsonb_build_object('applicationId',a.id,'expectedRevision',a.revision)) returning * into b;
 end if;
 select * into a from public.applications where id=a.id;
 response:=jsonb_build_object('application',to_jsonb(a)||jsonb_build_object('jobs',to_jsonb(j)),'job',private.backend_public_job(b));
 insert into private.backend_requests(user_id,event_key,operation,payload,response) values(owner_id,key,'applications.submit_job',payload,response);
 return response;
end $$;
revoke all on function private.queue_application_job(uuid,uuid,jsonb) from public,anon,authenticated;
create function private.queue_application_job_authenticated(payload jsonb) returns jsonb language sql security definer set search_path='' as $$ select private.queue_application_job(auth.uid(),null,payload) $$;
revoke all on function private.queue_application_job_authenticated(jsonb) from public,anon;
grant execute on function private.queue_application_job_authenticated(jsonb) to authenticated;
create function public.queue_application_job(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.queue_application_job_authenticated(payload) $$;
revoke all on function public.queue_application_job(jsonb) from public,anon;
grant execute on function public.queue_application_job(jsonb) to authenticated;

-- Keep the generic search queue closed; application work uses its scoped action.
alter function private.backend_action(uuid,uuid,text,jsonb) rename to backend_action_before_applications;
create function private.backend_action(owner_id uuid,bound_connection uuid,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if operation='backend.jobs.submit' and payload->>'kind'='application_submit' then raise exception 'Use queue_application_job' using errcode='22023';end if;
 return private.backend_action_before_applications(owner_id,bound_connection,operation,payload);
end $$;
revoke all on function private.backend_action(uuid,uuid,text,jsonb),private.backend_action_before_applications(uuid,uuid,text,jsonb) from public,anon,authenticated;

-- The Node API's fixed queue route and hosted MCP share the exact same helper.
alter function public.backend_job_dispatch(text,text,jsonb) rename to backend_job_dispatch_before_applications;
alter function public.backend_job_dispatch_before_applications(text,text,jsonb) set schema private;
create function public.backend_job_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'applications.submit_job' then return private.backend_job_dispatch_before_applications(credential_hash,operation,payload);end if;
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now();
 if not found then raise exception 'Invalid credential' using errcode='28000';end if;
 return private.queue_application_job(c.user_id,c.id,payload);
end $$;
revoke all on function public.backend_job_dispatch(text,text,jsonb),private.backend_job_dispatch_before_applications(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_job_dispatch(text,text,jsonb) to service_role;
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_application_jobs;
alter function public.agent_dispatch_before_application_jobs(text,text,jsonb) set schema private;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if operation='applications.submit_job' then return public.backend_job_dispatch(credential_hash,operation,payload);end if;
 return private.agent_dispatch_before_application_jobs(credential_hash,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb),private.agent_dispatch_before_application_jobs(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb),private.agent_dispatch_before_application_jobs(text,text,jsonb) to service_role;

-- Keep search claims separate: disabled submission workers cannot claim applications.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.backend_worker(text,jsonb)'::regprocedure);
 if strpos(definition,$old$where status='queued' or (status='running' and lease_expires_at<=now())$old$)=0 then raise exception 'Expected search claim boundary unavailable';end if;
 definition:=replace(definition,$old$where status='queued' or (status='running' and lease_expires_at<=now())$old$,$new$where kind='search_ats' and (status='queued' or (status='running' and lease_expires_at<=now()))$new$);
 execute definition;
end $$;
alter function public.backend_worker(text,jsonb) rename to backend_worker_before_applications;
alter function public.backend_worker_before_applications(text,jsonb) set schema private;
create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;c private.agent_connections;name text;args jsonb;app public.applications;target text;response jsonb;
begin
 if operation not in ('claim_application','application_dispatch') then return private.backend_worker_before_applications(operation,payload);end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>64000 then raise exception 'Invalid worker request' using errcode='22023';end if;
 if operation='claim_application' then
  if payload<>'{}' then raise exception 'Closed claim request' using errcode='22023';end if;
  for j in select * from private.backend_jobs where kind='application_submit' and (status='queued' or (status='running' and lease_expires_at<=now())) order by created_at for update skip locked limit 100 loop
   begin
    c:=private.backend_connection(j.user_id,j.connection_id,true);
    if not c.scopes @> array['approvals:read','resumes:read'] then raise insufficient_privilege;end if;
   exception when insufficient_privilege then
    update private.backend_jobs set status='cancelled',version=version+1,lease_token=null,lease_expires_at=null,finished_at=now(),result='{"summary":"Application execution connection unavailable."}' where id=j.id;continue;
   end;
   if j.attempts>=3 then
    update private.backend_jobs set status='failed',version=version+1,lease_token=null,lease_expires_at=null,finished_at=now(),result='{"summary":"Application retry limit reached. Inspect saved attempt before requesting another job."}' where id=j.id;continue;
   end if;
   update private.backend_jobs set status='running',attempts=attempts+1,version=version+1,lease_token=gen_random_uuid(),lease_expires_at=now()+interval '5 minutes',updated_at=now() where id=j.id returning * into j;
   return jsonb_build_object('job',private.backend_public_job(j),'credentialHash',c.token_hash,'leaseToken',j.lease_token);
  end loop;
  return null;
 end if;
 if payload-array['jobId','leaseToken','expectedVersion','name','args']<>'{}' or jsonb_typeof(payload->'args') is distinct from 'object' then raise exception 'Closed application dispatch request' using errcode='22023';end if;
 select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid and kind='application_submit' for update;
 if not found or j.status<>'running' or j.lease_token is distinct from (payload->>'leaseToken')::uuid or j.lease_expires_at<=now() or j.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Application lease changed' using errcode='40001';end if;
 c:=private.backend_connection(j.user_id,j.connection_id,true);
 if not c.scopes @> array['approvals:read','resumes:read'] then raise exception 'Submission scopes required' using errcode='42501';end if;
 select * into app from public.applications where user_id=j.user_id and id=(j.input->>'applicationId')::uuid;
 if not found then raise exception 'Owned application not found' using errcode='P0002';end if;
 name:=payload->>'name';args:=payload->'args';
 if name='runner_submission_context' then
  if args-array['app_id']<>'{}' or args->>'app_id' is distinct from app.id::text then raise exception 'Pinned application required' using errcode='42501';end if;
  return public.runner_submission_context(c.token_hash,app.id);
 elsif name='runner_submission_transition' then
  if args-array['operation','p_payload','expected_context','execution_authorization']<>'{}' or args->'p_payload'->>'applicationId' is distinct from app.id::text or args->>'operation' not in ('claim','start','finish') then raise exception 'Pinned submission transition required' using errcode='42501';end if;
  if args->>'operation'='claim' and args->'p_payload'->>'attemptId' is distinct from 'job-'||j.id::text then raise exception 'Stable job attempt required' using errcode='42501';end if;
  if args->>'operation' in ('start','finish') and not exists(select 1 from public.submission_attempts where user_id=j.user_id and application_id=app.id and id=(args->'p_payload'->>'claimId')::uuid and attempt_key='job-'||j.id::text) then raise exception 'Job attempt mismatch' using errcode='42501';end if;
  return public.runner_submission_transition(c.token_hash,args->>'operation',args->'p_payload',args->'expected_context',args->'execution_authorization');
 elsif name='agent_dispatch' then
  if args-array['operation','payload']<>'{}' or jsonb_typeof(args->'payload') is distinct from 'object' then raise exception 'Closed operation required' using errcode='22023';end if;
  target:=args->>'operation';response:=args->'payload';
  if target in ('context.personal','context.versions') then
   if response<>'{}' then raise exception 'Closed context required' using errcode='22023';end if;
  elsif target='search.context' then
   if response->>'profileId' is distinct from app.draft->>'searchProfileId' or response-array['profileId']<>'{}' then raise exception 'Pinned profile required' using errcode='42501';end if;
  elsif target='drafts.prepare' then
   if response->>'jobId' is distinct from app.job_id or response->>'expectedRevision' is distinct from app.revision::text then raise exception 'Pinned current draft required' using errcode='40001';end if;
  elsif target='runner.report_failure' then
   if response->>'applicationId' is distinct from app.id::text then raise exception 'Pinned failure required' using errcode='42501';end if;
  elsif target='resumes.read' then
   if response->>'resumeId' is distinct from app.draft->>'resumeId' or response-array['resumeId']<>'{}' then raise exception 'Pinned resume required' using errcode='42501';end if;
  else raise exception 'Unsupported application operation' using errcode='22023';end if;
  return public.agent_dispatch(c.token_hash,target,response);
 end if;
 raise exception 'Unsupported worker RPC' using errcode='22023';
end $$;
revoke all on function public.backend_worker(text,jsonb),private.backend_worker_before_applications(text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_worker(text,jsonb) to service_role;
commit;
