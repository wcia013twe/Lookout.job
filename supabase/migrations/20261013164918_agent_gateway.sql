-- Service-only RPC boundary. Owner identity comes from verified human Auth or
-- a hashed agent credential, never from an agent request's user_id field.
create function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('workspace:read','batches:write','drafts:write','activity:write','approvals:read'))
      then raise exception 'Invalid connection' using errcode='22023'; end if;
    -- Limits accidental repeated provisioning; revoked/expired entries do not count.
    if (select count(*) from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now()) >= 10 then
      raise exception 'Revoke an existing connection first' using errcode='22023';
    end if;
    insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
      values(owner_id,trim(payload->>'name'),payload->>'tokenHash',array(select jsonb_array_elements_text(payload->'scopes')),now()+make_interval(days=>days)) returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.list' then
    select coalesce(jsonb_agg(to_jsonb(c)-'token_hash' order by created_at desc),'[]') into result from private.agent_connections c where user_id=owner_id;
    return result;
  elsif operation = 'connections.revoke' then
    update private.agent_connections set revoked_at=coalesce(revoked_at,now()) where user_id=owner_id and id=(payload->>'id')::uuid returning * into connection;
    if not found then raise exception 'Owned connection not found' using errcode='P0002'; end if;
    return to_jsonb(connection)-'token_hash';
  end if;
  raise exception 'Unknown operation' using errcode='22023';
end $$;
revoke all on function public.manage_agent_connection(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_agent_connection(uuid,text,jsonb) to service_role;

create function public.agent_dispatch(credential_hash text, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; required_scope text; result jsonb;
  batch public.job_batches; app public.applications; job jsonb; v_job_id text; idx integer:=0;
begin
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if not found then raise exception 'Invalid credential' using errcode='28000'; end if;
  required_scope := case operation when 'workspace.read' then 'workspace:read' when 'batches.publish' then 'batches:write'
    when 'drafts.prepare' then 'drafts:write' when 'activity.append' then 'activity:write' when 'approvals.read' then 'approvals:read' end;
  if required_scope is null then raise exception 'Unknown operation' using errcode='22023'; end if;
  if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
  if operation = 'workspace.read' then
    return jsonb_build_object(
      'profile',(select to_jsonb(p) from public.profiles p where user_id=c.user_id),
      'preferences',(select to_jsonb(p) from public.preferences p where user_id=c.user_id),
      'answers',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.answer_library a where user_id=c.user_id),
      'resumes',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.resumes r where user_id=c.user_id),
      'applications',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from public.applications where user_id=c.user_id order by updated_at desc limit 100) a));
  elsif operation = 'batches.publish' then
    if length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 or length(trim(coalesce(payload->>'label',''))) not between 1 and 200
      or jsonb_typeof(payload->'jobs') is distinct from 'array' or jsonb_array_length(payload->'jobs') > 100 then
      raise exception 'Invalid batch' using errcode='22023'; end if;
    -- Retries return the original immutable batch, including original recommendations.
    insert into public.job_batches(user_id,label,batch_date,source_event_id) values(c.user_id,payload->>'label',coalesce((payload->>'date')::date,current_date),payload->>'eventKey')
      on conflict(user_id,source_event_id) do nothing returning * into batch;
    if batch.id is null then select * into batch from public.job_batches where user_id=c.user_id and source_event_id=payload->>'eventKey';
    else
      for job in select value from jsonb_array_elements(payload->'jobs') loop
        v_job_id := job->>'jobId';
        if v_job_id is null then
          -- Employer catalog data only. User-specific ranking belongs in recommendation.
          if job->>'canonicalUrl' !~ '^https://' or jsonb_typeof(job->'employer') is distinct from 'object' then raise exception 'Invalid job' using errcode='22023'; end if;
          v_job_id := 'agent-'||md5(job->>'canonicalUrl');
          insert into public.jobs(id,canonical_url,employer) values(v_job_id,job->>'canonicalUrl',job->'employer') on conflict(canonical_url) do nothing;
          select id into v_job_id from public.jobs where canonical_url=job->>'canonicalUrl';
        end if;
        if not exists(select 1 from public.jobs where id=v_job_id) then raise exception 'Unknown job' using errcode='22023'; end if;
        insert into public.batch_items(user_id,batch_id,job_id,position,recommendation) values(c.user_id,batch.id,v_job_id,idx,coalesce(job->'recommendation','{}'));
        idx:=idx+1;
      end loop;
    end if;
    return jsonb_build_object('batch',to_jsonb(batch),'items',(select coalesce(jsonb_agg(to_jsonb(i) order by position),'[]') from public.batch_items i where batch_id=batch.id),'url','https://wcia013twe.github.io/codex-automated-job-board/?batch='||batch.id::text);
  elsif operation = 'drafts.prepare' then
    if payload->>'jobId' is null or jsonb_typeof(payload->'draft') is distinct from 'object' or payload->>'expectedRevision' is null then
      raise exception 'Job, draft, expectedRevision required' using errcode='22023'; end if;
    select * into app from public.applications where user_id=c.user_id and applications.job_id=payload->>'jobId' for update;
    if not found then
      if (payload->>'expectedRevision')::integer <> -1 then raise exception 'Revision conflict' using errcode='40001'; end if;
      insert into public.applications(user_id,job_id) values(c.user_id,payload->>'jobId') on conflict(user_id,job_id) do nothing returning * into app;
      if app.id is null then raise exception 'Revision conflict' using errcode='40001'; end if;
    elsif app.revision<>(payload->>'expectedRevision')::integer then raise exception 'Revision conflict' using errcode='40001'; end if;
    if app.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Application is past drafting' using errcode='22023'; end if;
    update public.applications set draft=payload->'draft',blocker=nullif(payload->>'blocker','') where id=app.id returning * into app;
    return to_jsonb(app);
  elsif operation = 'activity.append' then
    if length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 or length(trim(coalesce(payload->>'kind',''))) not between 1 and 80
      or jsonb_typeof(coalesce(payload->'data','{}')) is distinct from 'object' then raise exception 'Invalid activity' using errcode='22023'; end if;
    if payload->>'applicationId' is not null and not exists(select 1 from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id) then raise exception 'Owned application not found' using errcode='P0002'; end if;
    insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
      values(c.user_id,(payload->>'applicationId')::uuid,payload->>'eventKey',payload->>'kind','agent',coalesce(payload->'data','{}')) on conflict(user_id,event_key) do nothing;
    select to_jsonb(e) into result from public.activity_events e where user_id=c.user_id and event_key=payload->>'eventKey'; return result;
  elsif operation = 'approvals.read' then
    select * into app from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id;
    if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
    return jsonb_build_object('application',to_jsonb(app),'approval',case when app.status='Approved' then (select to_jsonb(a) from public.approvals a where user_id=c.user_id and application_id=app.id and revision=app.revision) else null end);
  end if;
  raise exception 'Unknown operation' using errcode='22023';
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
