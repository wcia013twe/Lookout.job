begin;
-- Keep the deterministic implementation, but remove its queue claim/submit route.
alter function public.backend_worker(text,jsonb) rename to backend_worker_before_muse_requests;
alter function public.backend_worker_before_muse_requests(text,jsonb) set schema private;
revoke all on function private.backend_worker_before_muse_requests(text,jsonb) from public,anon,authenticated,service_role;
create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if operation='claim_application' then return null;end if;
 if operation='application_dispatch' and payload->>'name'='runner_submission_transition' and coalesce(payload->'args'->>'operation','')<>'finish' then
  raise exception 'AI Apply is owned by Muse; deterministic submission is paused' using errcode='42501';
 end if;
 -- Existing started actions may still persist their real finish; never issue a new click permit.
 return private.backend_worker_before_muse_requests(operation,payload);
end $$;
revoke all on function public.backend_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_worker(text,jsonb) to service_role;

-- Reuse the job journal and request replay ledger. No second workflow store.
alter function public.backend_job_dispatch(text,text,jsonb) rename to backend_job_dispatch_before_muse_requests;
alter function public.backend_job_dispatch_before_muse_requests(text,text,jsonb) set schema private;
revoke all on function private.backend_job_dispatch_before_muse_requests(text,text,jsonb) from public,anon,authenticated,service_role;
create function public.backend_job_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;j private.backend_jobs;a public.applications;r private.backend_requests;response jsonb;key text:=payload->>'eventKey';
begin
 if operation not in ('applications.request.claim','applications.request.report') then return private.backend_job_dispatch_before_muse_requests(credential_hash,operation,payload);end if;
 perform public.agent_dispatch(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read']::text[] <@ c.scopes then raise exception 'Application work scopes required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['jobId','expectedVersion','expectedRevision','eventKey','outcome','summary']<>'{}'
  or not payload ?& array['jobId','expectedVersion','expectedRevision','eventKey']
  or jsonb_typeof(payload->'jobId') is distinct from 'string'
  or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[1-9][0-9]{0,8}$'
  or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or coalesce(payload->>'expectedRevision','') !~ '^[0-9]{1,9}$'
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(key,''))) not between 1 and 160 or length(key)>160 or key ~ '[[:cntrl:]]'
  or (operation='applications.request.claim' and payload ?| array['outcome','summary'])
  or (operation='applications.request.report' and (coalesce(payload->>'outcome','') not in ('prepared','completed','blocked','uncertain') or jsonb_typeof(payload->'summary') is distinct from 'string' or length(trim(coalesce(payload->>'summary',''))) not between 1 and 1000 or length(payload->>'summary')>1000))
 then raise exception 'Exact versioned application request required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,98));
 select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid and user_id=c.user_id and connection_id=c.id and kind='application_submit' for update;
 if not found then raise exception 'Owned connection-bound application request required' using errcode='42501';end if;
 select * into r from private.backend_requests where user_id=c.user_id and event_key=key;
 if found then
  if r.operation<>operation or r.payload<>payload then raise exception 'Retry key changed' using errcode='40001';end if;
  return r.response;
 end if;
 if j.version<>(payload->>'expectedVersion')::integer then raise exception 'Application request changed' using errcode='40001';end if;
 select * into a from public.applications where id=(j.input->>'applicationId')::uuid and user_id=c.user_id for update;
 if not found or a.revision<>(payload->>'expectedRevision')::integer then raise exception 'Application draft changed; read current work' using errcode='40001';end if;
 if operation='applications.request.claim' then
  if j.status<>'queued' or private.work_is_stopped(c.user_id,a.id) or a.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Application request cannot start' using errcode='42501';end if;
  if exists(select 1 from public.submission_attempts where application_id=a.id and state in ('claimed','started','confirmed','uncertain')) then raise exception 'Existing submission attempt requires reconciliation' using errcode='42501';end if;
  update private.backend_jobs set status='running',attempts=attempts+1,version=version+1,updated_at=now(),lease_token=null,lease_expires_at=null,
   result=jsonb_build_object('executor','muse','outcome','working','applicationId',a.id,'applicationRevision',a.revision,'summary','Muse picked up the application request. No submission is implied.') where id=j.id returning * into j;
 else
  if j.status<>'running' or j.result->>'executor' is distinct from 'muse' then raise exception 'Only a picked-up Muse request can report an outcome' using errcode='42501';end if;
  update private.backend_jobs set status=case when payload->>'outcome' in ('blocked','uncertain') then 'partial' else 'completed' end,version=version+1,updated_at=now(),finished_at=now(),
   result=jsonb_build_object('executor','muse','outcome',payload->>'outcome','applicationId',a.id,'applicationRevision',a.revision,'summary',payload->>'summary','verifiedSubmission',false)
   where id=j.id returning * into j;
 end if;
 response:=jsonb_build_object('job',private.backend_public_job(j),'applicationId',a.id);
 insert into private.backend_requests(user_id,event_key,operation,payload,response) values(c.user_id,key,operation,payload,response);
 return response;
end $$;
revoke all on function public.backend_job_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_job_dispatch(text,text,jsonb) to service_role;

-- Emit the same idempotent pointer key as the connected Action Board pipeline.
create function private.emit_muse_application_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='application_submit' and new.status='queued' then
  insert into public.activity_events(user_id,event_key,kind,actor,payload)
  values(new.user_id,'muse-feed:application-request:'||new.id,'muse.application_requested','system',
   jsonb_build_object('entity','backend_job','recordId',new.id,'applicationId',new.input->>'applicationId','version',new.version,'status',new.status,'text','AI Apply requested. Muse must claim this request and use its host browser; no deterministic worker runs.'))
  on conflict(user_id,event_key) do nothing;
 end if;return new;
end $$;
revoke all on function private.emit_muse_application_request() from public,anon,authenticated;
create trigger muse_application_request after insert on private.backend_jobs for each row execute function private.emit_muse_application_request();
-- Include queued requests in existing per-connection feed/count/ack checks.
-- Later feed extensions preserve this label; repeating it in an IN list is harmless.
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.pronargs=3 and p.prosrc like '%Owned change events required%' and p.prosrc like '%changes.read%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one Muse feed implementation';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$'muse.schedule_changed'$old$,$new$'muse.schedule_changed','muse.application_requested'$new$);
 if changed=definition then raise exception 'Expected feed allowlist unavailable';end if;execute changed;
 definition:=pg_get_functiondef('public.agent_pending_count(uuid)'::regprocedure);
 changed:=replace(definition,$old$'muse.schedule_changed'$old$,$new$'muse.schedule_changed','muse.application_requested'$new$);
 if changed=definition then raise exception 'Expected watch allowlist unavailable';end if;execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
