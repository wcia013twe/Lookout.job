-- Attempts are execution evidence, never human approvals. One unresolved/confirmed
-- attempt per owned application prevents a second worker or uncertain retry.
create table public.submission_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null, credential_id uuid references private.agent_connections(id) on delete set null,
  attempt_key text not null check(length(attempt_key) between 1 and 80),
  revision integer not null, state text not null check(state in ('claimed','started','confirmed','uncertain','cancelled')),
  context_snapshot jsonb not null, authorization_snapshot jsonb not null, receipt jsonb,
  created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
  started_at timestamptz, finished_at timestamptz,
  foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade,
  unique(application_id,attempt_key)
);
alter table public.submission_attempts enable row level security;
create policy submission_attempts_owner_read on public.submission_attempts for select to authenticated using((select auth.uid())=user_id);
grant select on public.submission_attempts to authenticated;
grant all on public.submission_attempts to service_role;
create unique index submission_attempts_one_active on public.submission_attempts(application_id) where state in ('claimed','started','confirmed','uncertain');
create index submission_attempts_owner_application on public.submission_attempts(user_id,application_id);

create function private.submission_context(owner_id uuid, app_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object('application',to_jsonb(a),'job',to_jsonb(j),
    'profile',(select to_jsonb(p) from public.profiles p where p.user_id=owner_id),
    'preferences',(select to_jsonb(p) from public.preferences p where p.user_id=owner_id),
    'resume',(select to_jsonb(r) from public.resumes r where r.user_id=owner_id and r.id::text=a.draft->>'resumeId'),
    'resumes',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.resumes r where r.user_id=owner_id),
    'answers',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.answer_library b where b.user_id=owner_id),
    'approval',case when a.status='Approved' then (select to_jsonb(p) from public.approvals p where p.user_id=owner_id and p.application_id=a.id and p.revision=a.revision) else null end,
    'personalVersion',coalesce((select v.version from private.agent_settings_versions v where v.user_id=owner_id),1))
  from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id and a.id=app_id;
$$;
revoke all on function private.submission_context(uuid,uuid) from public,anon,authenticated;
grant execute on function private.submission_context(uuid,uuid) to service_role;

create function public.runner_submission_context(credential_hash text, app_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; result jsonb;
begin
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not array['workspace:read','drafts:write','approvals:read','resumes:read']::text[] <@ c.scopes then raise exception 'Scope required' using errcode='42501'; end if;
  result:=private.submission_context(c.user_id,app_id);
  if result is null then raise exception 'Owned application not found' using errcode='P0002'; end if;
  return result;
end $$;
revoke all on function public.runner_submission_context(text,uuid) from public,anon,authenticated;
grant execute on function public.runner_submission_context(text,uuid) to service_role;

-- expected_context/authorization are supplied only by the trusted Edge handler,
-- which validates policy and answer provenance. Clients cannot invoke this RPC.
create function public.runner_submission_transition(credential_hash text, operation text, p_payload jsonb,
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
      if observed_receipt->>'source' is distinct from 'runner-observed-greenhouse-confirmation'
        or observed_receipt->>'jobUrl' is distinct from t.context_snapshot->'job'->>'canonical_url'
        or observed_receipt->>'marker' not in ('#confirmation','#application_confirmation','[data-testid="application-confirmation"]')
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

create function private.freeze_inflight_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.draft is distinct from old.draft or new.blocker is distinct from old.blocker)
    and exists(select 1 from public.submission_attempts where application_id=old.id and state in ('claimed','started')) then
    raise exception 'Submission is in progress; wait for its outcome' using errcode='40001';
  end if;
  return new;
end $$;
revoke all on function private.freeze_inflight_submission() from public,anon,authenticated;
create trigger freeze_inflight_submission before update on public.applications for each row execute function private.freeze_inflight_submission();

-- Human-only recovery. A negative confirmation permits a new attempt; it is not
-- an employer receipt and cannot be called by an opaque agent credential.
create function private.resolve_submission_attempt(app_id uuid, expected_revision integer, claim_id uuid, note text)
returns public.applications language plpgsql security definer set search_path='' as $$
declare a public.applications; t public.submission_attempts;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if length(trim(coalesce(note,''))) not between 1 and 500 then raise exception 'Verification note required' using errcode='22023'; end if;
  select * into a from public.applications where id=app_id and user_id=auth.uid() for update;
  if not found or a.revision<>expected_revision then raise exception 'Owned current application required' using errcode='40001'; end if;
  if a.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Application is past drafting' using errcode='22023'; end if;
  select * into t from public.submission_attempts where id=claim_id and application_id=a.id and user_id=auth.uid() for update;
  if not found or not (t.state='uncertain' or (t.state='started' and t.started_at<now()-interval '5 minutes')) then raise exception 'Attempt is not ready for human verification' using errcode='22023'; end if;
  update public.submission_attempts set state='cancelled',finished_at=now() where id=t.id;
  update public.applications set blocker=null where id=a.id returning * into a;
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
    values(auth.uid(),a.id,'resolve:'||t.id,'submission_verified_not_sent','user',jsonb_build_object('text','You verified that no application was submitted: '||trim(note),'claimId',t.id));
  return a;
end $$;
revoke all on function private.resolve_submission_attempt(uuid,integer,uuid,text) from public,anon;
grant execute on function private.resolve_submission_attempt(uuid,integer,uuid,text) to authenticated;
create function public.resolve_submission_attempt(app_id uuid,expected_revision integer,claim_id uuid,note text)
returns public.applications language sql security invoker set search_path='' as $$ select private.resolve_submission_attempt(app_id,expected_revision,claim_id,note) $$;
revoke all on function public.resolve_submission_attempt(uuid,integer,uuid,text) from public,anon;
grant execute on function public.resolve_submission_attempt(uuid,integer,uuid,text) to authenticated;
