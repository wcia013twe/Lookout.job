-- Scoped failure reporting preserves the reviewed draft and records a human next step.
create function private.report_runner_failure(credential_hash text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; app public.applications; event public.activity_events;
begin
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not 'drafts:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
  if jsonb_typeof(p_payload) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_payload) key where key not in ('applicationId','eventKey','expectedRevision','stage','outcome','reason','nextAction','attempts'))
    or coalesce(p_payload->>'stage','') not in ('approval','playwright','agent','submission')
    or coalesce(p_payload->>'outcome','') not in ('blocked','uncertain')
    or length(trim(coalesce(p_payload->>'eventKey',''))) not between 1 and 200
    or length(trim(coalesce(p_payload->>'reason',''))) not between 1 and 500
    or length(trim(coalesce(p_payload->>'nextAction',''))) not between 1 and 500
    or jsonb_typeof(p_payload->'attempts') is distinct from 'array' or jsonb_array_length(p_payload->'attempts')>3
    or p_payload->>'expectedRevision' is null then raise exception 'Invalid failure' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'attempts') a where jsonb_typeof(a)<>'object'
    or coalesce(a->>'stage','') not in ('approval','playwright','agent') or coalesce(a->>'status','') not in ('failed','prepared','uncertain')
    or exists(select 1 from jsonb_object_keys(a) key where key not in ('stage','status'))) then raise exception 'Invalid attempts' using errcode='22023'; end if;
  select * into app from public.applications where id=(p_payload->>'applicationId')::uuid and user_id=c.user_id for update;
  if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
  select * into event from public.activity_events where user_id=c.user_id and event_key=p_payload->>'eventKey';
  if found then
    if event.application_id is distinct from app.id or event.kind<>'runner_failure' then raise exception 'Event key already used' using errcode='22023'; end if;
    return jsonb_build_object('application',to_jsonb(app),'event',to_jsonb(event),'replayed',true);
  end if;
  if app.revision<>(p_payload->>'expectedRevision')::integer then raise exception 'Revision conflict' using errcode='40001'; end if;
  if app.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Application is past drafting' using errcode='22023'; end if;
  update public.applications set blocker=(p_payload->>'reason')||' Next: '||(p_payload->>'nextAction') where id=app.id returning * into app;
  -- A repeated failure may match the old blocker; explicitly retain Blocked without altering the draft.
  update public.applications set status='Blocked' where id=app.id returning * into app;
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
    values(c.user_id,app.id,p_payload->>'eventKey','runner_failure','agent',p_payload-'applicationId'-'eventKey') returning * into event;
  return jsonb_build_object('application',to_jsonb(app),'event',to_jsonb(event),'replayed',false);
end $$;
revoke all on function private.report_runner_failure(text,jsonb) from public,anon,authenticated;
grant execute on function private.report_runner_failure(text,jsonb) to service_role;

create or replace function public.agent_dispatch(credential_hash text, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; result jsonb;
begin
  if operation='runner.report_failure' then return private.report_runner_failure(credential_hash,payload); end if;
  if operation not in ('context.versions','context.personal','context.developer') then
    return private.agent_dispatch_core(credential_hash,operation,payload);
  end if;
  -- Core verification holds the credential share lock through this transaction.
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not 'workspace:read'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
  if payload is distinct from '{}'::jsonb then raise exception 'No context arguments allowed' using errcode='22023'; end if;
  if operation='context.developer' then return '{}'::jsonb; end if;
  if operation='context.versions' then
    return jsonb_build_object('personalVersion',coalesce((select version from private.agent_settings_versions where user_id=c.user_id),1));
  end if;
  -- One statement snapshot keeps the version paired with the returned settings.
  select jsonb_build_object(
    'personalVersion',coalesce((select version from private.agent_settings_versions where user_id=c.user_id),1),
    'settings',jsonb_build_object(
      'profile',(select to_jsonb(p)-'updated_at' from public.profiles p where user_id=c.user_id),
      'preferences',(select to_jsonb(p)-'updated_at' from public.preferences p where user_id=c.user_id),
      'answers',(select coalesce(jsonb_agg(to_jsonb(a)-'updated_at' order by id),'[]') from public.answer_library a where user_id=c.user_id),
      'resumes',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.resumes r where user_id=c.user_id)
    )) into result;
  return result;
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
