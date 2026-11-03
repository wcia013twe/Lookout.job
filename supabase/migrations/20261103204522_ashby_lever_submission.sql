-- Extend the existing scoped queue and one-click attempt flow; preserve grants and ownership checks.
create function private.submission_platform(url text) returns text
language sql immutable security invoker set search_path='' as $$
 select case
  when url ~ '^https://(job-boards|boards)\.greenhouse\.io/[a-zA-Z0-9_-]+/jobs/[0-9]+$' then 'greenhouse'
  when url ~ '^https://jobs\.ashbyhq\.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9-]+$' then 'ashby'
  when url ~ '^https://jobs\.(eu\.)?lever\.co/[a-zA-Z0-9_-]+/[a-zA-Z0-9-]+$' then 'lever'
  else null end
$$;
revoke all on function private.submission_platform(text) from public,anon,authenticated;
grant execute on function private.submission_platform(text) to service_role;

-- Recheck platform/source, URL, marker and message at persistence, as at Edge.
create function private.valid_submission_receipt(receipt jsonb) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(jsonb_typeof(receipt)='object'
  and receipt-array['source','jobUrl','observedUrl','marker','message']='{}'::jsonb
  and receipt->>'source'='runner-observed-'||private.submission_platform(receipt->>'jobUrl')||'-confirmation'
  and length(receipt->>'jobUrl')<=2048 and length(receipt->>'observedUrl')<=2048
  and jsonb_typeof(receipt->'message')='string' and length(receipt->>'message') between 1 and 1000
  and receipt->>'message' ~* 'thank you for applying|thanks for applying|application (has been |was )?submitted|application (has been |was )?received|received your application'
  and receipt->>'message' !~* 'already applied|already received|previously|spam|could not|couldn''t|unable|not (been )?(submitted|received)|haven''t received|have not received|limit reached'
  and case private.submission_platform(receipt->>'jobUrl')
   when 'greenhouse' then receipt->>'marker' in ('#confirmation','#application_confirmation','[data-testid="application-confirmation"]')
    and receipt->>'observedUrl' in (receipt->>'jobUrl',(receipt->>'jobUrl')||'/confirmation')
   when 'ashby' then receipt->>'marker' in ('[data-testid="application-confirmation"]','.ashby-application-form-success','h1','h2')
    and receipt->>'observedUrl' in (receipt->>'jobUrl',(receipt->>'jobUrl')||'/application',(receipt->>'jobUrl')||'/confirmation')
   when 'lever' then receipt->>'marker' in ('.application-received','[data-qa="application-confirmation"]','h1','h2')
    and receipt->>'observedUrl' in (receipt->>'jobUrl',(receipt->>'jobUrl')||'/apply',(receipt->>'jobUrl')||'/thanks',(receipt->>'jobUrl')||'/apply/thanks',(receipt->>'jobUrl')||'/apply/success')
   else false end, false)
$$;
revoke all on function private.valid_submission_receipt(jsonb) from public,anon,authenticated;
grant execute on function private.valid_submission_receipt(jsonb) to service_role;

create or replace function public.runner_submission_transition(credential_hash text, operation text, p_payload jsonb,
  expected_context jsonb default null, execution_authorization jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; a public.applications; t public.submission_attempts; current_context jsonb; observed_receipt jsonb;
begin
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not array['workspace:read','drafts:write','approvals:read','resumes:read']::text[] <@ c.scopes then raise exception 'Scope required' using errcode='42501'; end if;
  select * into a from public.applications where id=(p_payload->>'applicationId')::uuid and user_id=c.user_id for update;
  if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
  if operation in ('claim','start') then
    perform 1 from private.agent_settings_versions where user_id=c.user_id for share;
    current_context:=private.submission_context(c.user_id,a.id);
    if expected_context is null or current_context is distinct from expected_context then raise exception 'Context changed' using errcode='40001'; end if;
    if execution_authorization->>'mode' not in ('human','automatic') or execution_authorization->'snapshot'->'draft' is distinct from a.draft
      or execution_authorization->>'applicationId' is distinct from a.id::text or execution_authorization->>'userId' is distinct from a.user_id::text
      or execution_authorization->'snapshot'->'resume' is distinct from current_context->'resume'
      or (execution_authorization->>'revision')::integer is distinct from a.revision then raise exception 'Authorization required' using errcode='42501'; end if;
    if execution_authorization->>'mode'='human' and execution_authorization->>'id' is distinct from current_context->'approval'->>'id' then raise exception 'Human approval required' using errcode='42501'; end if;
    if execution_authorization->>'mode'='automatic' and current_context->'preferences'->'search'->'autoSubmitApproved' is distinct from 'true'::jsonb then raise exception 'Auto-apply is off' using errcode='42501'; end if;
    if a.status not in ('Queued','Draft','Awaiting approval','Approved') or nullif(a.blocker,'') is not null then raise exception 'Application cannot submit' using errcode='22023'; end if;
  end if;
  if operation='claim' then
    if length(coalesce(p_payload->>'attemptId','')) not between 1 and 80 then raise exception 'Attempt ID required' using errcode='22023'; end if;
    -- Expired pre-click leases may be cancelled; started/uncertain never expire into retry.
    update public.submission_attempts set state='cancelled',finished_at=now() where application_id=a.id and state='claimed' and expires_at<now();
    select * into t from public.submission_attempts where application_id=a.id and attempt_key=p_payload->>'attemptId';
    if found then return jsonb_build_object('attempt',to_jsonb(t)-'context_snapshot'-'authorization_snapshot','canProceed',false); end if;
    select * into t from public.submission_attempts where application_id=a.id and state in ('claimed','started','confirmed','uncertain');
    if found then return jsonb_build_object('attempt',to_jsonb(t)-'context_snapshot'-'authorization_snapshot','canProceed',false); end if;
    insert into public.submission_attempts(user_id,application_id,credential_id,attempt_key,revision,state,context_snapshot,authorization_snapshot)
      values(c.user_id,a.id,c.id,p_payload->>'attemptId',a.revision,'claimed',current_context,execution_authorization) returning * into t;
    return jsonb_build_object('attempt',to_jsonb(t)-'context_snapshot'-'authorization_snapshot','canProceed',true);
  end if;
  select * into t from public.submission_attempts where id=(p_payload->>'claimId')::uuid and application_id=a.id and user_id=c.user_id for update;
  if not found or (operation='start' and t.credential_id is distinct from c.id) then raise exception 'Owned attempt not found' using errcode='P0002'; end if;
  if operation='start' then
    if t.state<>'claimed' then return jsonb_build_object('canClick',false,'state',t.state); end if;
    if t.expires_at<now() or t.context_snapshot is distinct from current_context or t.authorization_snapshot is distinct from execution_authorization then raise exception 'Attempt context changed' using errcode='40001'; end if;
    update public.submission_attempts set state='started',started_at=now() where id=t.id;
    return jsonb_build_object('canClick',true,'claimId',t.id,'permitExpiresAt',now()+interval '5 seconds');
  elsif operation='finish' then
    if t.state in ('confirmed','uncertain','cancelled') then return jsonb_build_object('state',t.state,'application',to_jsonb(a),'replayed',true); end if;
    if p_payload->>'outcome'='cancelled' and t.state='claimed' then
      update public.submission_attempts set state='cancelled',finished_at=now() where id=t.id;
      return jsonb_build_object('state','cancelled','application',to_jsonb(a));
    end if;
    if t.state<>'started' or p_payload->>'outcome' not in ('confirmed','uncertain') then raise exception 'Attempt has not started' using errcode='22023'; end if;
    observed_receipt:=p_payload->'receipt';
    if p_payload->>'outcome'='confirmed' then
      if not private.valid_submission_receipt(observed_receipt)
        or observed_receipt->>'jobUrl' is distinct from t.context_snapshot->'job'->>'canonical_url'
        or length(coalesce(observed_receipt->>'message','')) not between 1 and 1000 then raise exception 'Confirmation required' using errcode='22023'; end if;
      update public.submission_attempts set state='confirmed',finished_at=now(),receipt=observed_receipt where id=t.id;
      update public.applications set status=case when status in ('Interview','Offer','Rejected','Withdrawn') then status else 'Submitted' end,
        submitted_at=coalesce(submitted_at,now()),receipt=observed_receipt where id=a.id returning * into a;
    else
      update public.submission_attempts set state='uncertain',finished_at=now() where id=t.id;
      if a.status not in ('Submitted','Interview','Offer','Rejected','Withdrawn') then
        update public.applications set blocker='Submission outcome uncertain. Check the employer portal or confirmation email before another attempt.',status='Blocked' where id=a.id returning * into a;
      end if;
    end if;
    insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
      values(c.user_id,a.id,'submission:'||t.id,p_payload->>'outcome','agent',jsonb_build_object('text',case when p_payload->>'outcome'='confirmed' then 'Runner observed employer submission confirmation' else 'Submission uncertain; automatic retry paused' end,'claimId',t.id,'receipt',observed_receipt)) on conflict(user_id,event_key) do nothing;
    return jsonb_build_object('state',p_payload->>'outcome','application',to_jsonb(a));
  end if;
  raise exception 'Unknown transition' using errcode='22023';
end $$;
revoke all on function public.runner_submission_transition(text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.runner_submission_transition(text,text,jsonb,jsonb,jsonb) to service_role;

create or replace function private.queue_application_job(owner_id uuid,bound_connection uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  or jsonb_typeof(p->'url') is distinct from 'string' or length(p->>'url')>2048 or private.submission_platform(p->>'url') is null
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
