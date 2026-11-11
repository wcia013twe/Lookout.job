begin;
-- Extend the existing request transaction with atomic final draft persistence.
alter function public.backend_job_dispatch(text,text,jsonb) rename to backend_job_dispatch_before_finalization;
alter function public.backend_job_dispatch_before_finalization(text,text,jsonb) set schema private;
revoke all on function private.backend_job_dispatch_before_finalization(text,text,jsonb) from public,anon,authenticated,service_role;
create function public.backend_job_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;j private.backend_jobs;a public.applications;r private.backend_requests;
 response jsonb;key text:=payload->>'eventKey';draft jsonb;blocker text;next_status text;outcome text;job jsonb;profile_id text;
begin
 if operation='applications.request.claim' then
  -- Claim responses persist the owned application so a client need not issue a
  -- context read that could fail after the claim has committed.
  perform public.agent_dispatch(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read']::text[] <@ c.scopes then raise exception 'Application work scopes required' using errcode='42501';end if;
  if jsonb_typeof(payload) is distinct from 'object' or payload-array['jobId','expectedVersion','expectedRevision','eventKey']<>'{}'
   or not payload ?& array['jobId','expectedVersion','expectedRevision','eventKey']
   or jsonb_typeof(payload->'jobId') is distinct from 'string' or payload->>'jobId' !~ '^[0-9a-fA-F-]{36}$'
   or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[1-9][0-9]{0,8}$'
   or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or coalesce(payload->>'expectedRevision','') !~ '^[0-9]{1,9}$'
   or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(key,''))) not between 1 and 160 or length(key)>160 or key ~ '[[:cntrl:]]'
  then raise exception 'Exact versioned application request required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,98));
  select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid and user_id=c.user_id and connection_id=c.id and kind='application_submit' for update;
  if not found then raise exception 'Owned connection-bound application request required' using errcode='42501';end if;
  select * into r from private.backend_requests where user_id=c.user_id and event_key=key;
  if found then
   if r.operation<>operation or r.payload<>payload then raise exception 'Retry key changed' using errcode='40001';end if;
   return r.response;
  end if;
  response:=private.backend_job_dispatch_before_finalization(credential_hash,operation,payload);
  select * into a from public.applications where id=(response->>'applicationId')::uuid and user_id=c.user_id;
  select to_jsonb(jb) into job from public.jobs jb where jb.id=a.job_id;
  response:=response||jsonb_build_object('application',to_jsonb(a),'jobRecord',job);
  update private.backend_requests set response=response where user_id=c.user_id and event_key=key;
  return response;
 elsif operation<>'applications.request.finalize' then
  return private.backend_job_dispatch_before_finalization(credential_hash,operation,payload);
 end if;
 -- Authentication and scope checks precede replay, so revocation is immediate.
 perform public.agent_dispatch(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read']::text[] <@ c.scopes then raise exception 'Application work scopes required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object'
  or payload-array['jobId','expectedVersion','expectedRevision','eventKey','finalDraft','blocker','browserInspected','outcome','summary']<>'{}'
  or not payload ?& array['jobId','expectedVersion','expectedRevision','eventKey','finalDraft','browserInspected','outcome','summary']
  or jsonb_typeof(payload->'jobId') is distinct from 'string'
  or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[1-9][0-9]{0,8}$'
  or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or coalesce(payload->>'expectedRevision','') !~ '^[0-9]{1,9}$'
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(key,''))) not between 1 and 160 or length(key)>160 or key ~ '[[:cntrl:]]'
  or jsonb_typeof(payload->'finalDraft') is distinct from 'object'
  or jsonb_typeof(payload->'finalDraft'->'questions') is distinct from 'array'
  or exists(select 1 from jsonb_array_elements(payload->'finalDraft'->'questions') q where jsonb_typeof(q) is distinct from 'object' or (q?'required' and jsonb_typeof(q->'required') is distinct from 'boolean') or (q?'answer' and jsonb_typeof(q->'answer') not in ('string','null')))
  or jsonb_typeof(payload->'browserInspected') is distinct from 'boolean'
  or jsonb_typeof(payload->'outcome') is distinct from 'string' or coalesce(payload->>'outcome','') not in ('prepared','blocked','uncertain')
  or jsonb_typeof(payload->'summary') is distinct from 'string' or length(trim(coalesce(payload->>'summary',''))) not between 1 and 1000 or length(payload->>'summary')>1000
  or (payload?'blocker' and (jsonb_typeof(payload->'blocker') is distinct from 'string' or length(payload->>'blocker')>1000))
 then raise exception 'Exact final application request required' using errcode='22023';end if;
 outcome:=payload->>'outcome';blocker:=nullif(trim(payload->>'blocker'),'');draft:=payload->'finalDraft';
 if (outcome='prepared' and (payload->>'browserInspected'<>'true' or blocker is not null
      or exists(select 1 from jsonb_array_elements(draft->'questions') q where q->>'required'='true' and length(trim(coalesce(q->>'answer','')))=0)))
    or (outcome in ('blocked','uncertain') and blocker is null) then
  raise exception 'Final draft readiness and outcome disagree' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,98));
 select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid and user_id=c.user_id and connection_id=c.id and kind='application_submit' for update;
 if not found then raise exception 'Owned connection-bound application request required' using errcode='42501';end if;
 select * into r from private.backend_requests where user_id=c.user_id and event_key=key;
 if found then
  if r.operation<>operation or r.payload<>payload then raise exception 'Retry key changed' using errcode='40001';end if;
  return r.response;
 end if;
 if j.version<>(payload->>'expectedVersion')::integer then raise exception 'Application request changed' using errcode='40001';end if;
 if j.status<>'running' or j.result->>'executor' is distinct from 'muse' then raise exception 'Only a picked-up Muse request can finalize' using errcode='42501';end if;
 select * into a from public.applications where id=(j.input->>'applicationId')::uuid and user_id=c.user_id for update;
 if not found or a.revision<>(payload->>'expectedRevision')::integer then raise exception 'Application draft changed; read current work' using errcode='40001';end if;
 if private.work_is_stopped(c.user_id,a.id) or exists(select 1 from private.backend_jobs b where b.id=j.id and b.status='cancelled') then raise exception 'Application request stopped or cancelled' using errcode='42501';end if;
 if draft?'resumeId' and jsonb_typeof(draft->'resumeId') is distinct from 'null' and (jsonb_typeof(draft->'resumeId') is distinct from 'string' or draft->>'resumeId' !~ '^[0-9a-fA-F-]{36}$' or not exists(select 1 from public.resumes x where x.id=(draft->>'resumeId')::uuid and x.user_id=c.user_id)) then raise exception 'Final draft resume must belong to this user' using errcode='42501';end if;
 profile_id:=draft->>'searchProfileId';
 if draft?'searchProfileId' and jsonb_typeof(draft->'searchProfileId') is distinct from 'null' and (jsonb_typeof(draft->'searchProfileId') is distinct from 'string' or profile_id !~ '^[a-zA-Z0-9_-]{1,80}$' or not exists(select 1 from public.search_documents x where x.user_id=c.user_id and x.kind='profile' and x.id=profile_id and x.projection->>'active' is distinct from 'false')) then raise exception 'Final draft search profile must be owned and active' using errcode='42501';end if;
 -- This is the canonical writer; exceptions roll back draft, job and replay receipt together.
 perform public.agent_dispatch(credential_hash,'drafts.prepare',jsonb_build_object('jobId',a.job_id,'expectedRevision',a.revision,'draft',draft,'blocker',blocker));
 select * into a from public.applications where id=a.id and user_id=c.user_id;
 next_status:=case when outcome in ('blocked','uncertain') then 'partial' else 'completed' end;
 update private.backend_jobs set status=next_status,version=version+1,updated_at=now(),finished_at=now(),
  result=jsonb_build_object('executor','muse','outcome',outcome,'applicationId',a.id,'applicationRevision',a.revision,'summary',payload->>'summary','verifiedSubmission',false)
  where id=j.id returning * into j;
 response:=jsonb_build_object('job',private.backend_public_job(j),'application',to_jsonb(a),
  'actionBoardItems',coalesce((select jsonb_agg(item) from private.action_board_items(c.user_id) item where item->>'applicationId'=a.id::text),'[]'),
  'verifiedSubmission',false,'approved',false);
 insert into private.backend_requests(user_id,event_key,operation,payload,response) values(c.user_id,key,operation,payload,response);
 return response;
end $$;
revoke all on function public.backend_job_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_job_dispatch(text,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
