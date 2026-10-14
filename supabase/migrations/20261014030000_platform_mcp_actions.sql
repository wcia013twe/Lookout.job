begin;
-- Scoped actions delegate existing operations rather than replacing the service.
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to platform_dispatch_previous;
revoke all on function private.platform_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
create function private.platform_actions_for_owner(owner_id uuid,operation text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; p public.preferences; f public.profiles; a public.answer_library; b public.job_batches; result jsonb; expected timestamptz; allowed text[]; required_scope text;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 allowed:=case operation
 when 'profile.save' then array['facts','expectedUpdatedAt']
 when 'answers.save' then array['id','question','answer','companyScope','expectedUpdatedAt']
 when 'answers.delete' then array['id','expectedUpdatedAt']
 when 'preferences.tiers.save' then array['tierLists','activeTierListId','expectedUpdatedAt']
 when 'preferences.notifications.save' then array['settings','expectedUpdatedAt']
 when 'preferences.theme.save' then array['theme','expectedUpdatedAt']
 when 'preferences.resumes.save' then array['defaultResumeId','resumeRules','expectedUpdatedAt']
 when 'jobs.list' then array['limit','offset']
 when 'batches.read' then array['batchId']
 when 'batches.item.mark' then array['batchId','jobId','action']
 when 'leaderboard.read' then array['limit']
 when 'selection.reconsider.simple' then array['id']
 when 'human.request' then array['action','recordId'] end;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& allowed or octet_length(payload::text)>100000
 or exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed)) then raise exception 'Invalid arguments' using errcode='22023'; end if;
 if payload ? 'expectedUpdatedAt' then expected:=(payload->>'expectedUpdatedAt')::timestamptz; end if;
 if operation='profile.save' then
  if jsonb_typeof(payload->'facts') is distinct from 'object' then raise exception 'Facts required' using errcode='22023'; end if;
  select * into f from public.profiles where user_id=owner_id for update;
  if f.updated_at is distinct from expected then raise exception 'Profile changed' using errcode='40001'; end if;
  insert into public.profiles(user_id,facts,verified_at) values(owner_id,payload->'facts',null)
   on conflict(user_id) do update set facts=excluded.facts,verified_at=null,updated_at=now() returning to_jsonb(profiles) into result;
 elsif operation in ('answers.save','answers.delete') then
  select * into a from public.answer_library where id=(payload->>'id')::uuid and user_id=owner_id for update;
  if a.updated_at is distinct from expected then raise exception 'Answer changed' using errcode='40001'; end if;
  if operation='answers.delete' then
   if a.id is null then raise exception 'Owned answer not found' using errcode='P0002'; end if;
   delete from public.answer_library where id=a.id and user_id=owner_id;
   result:=jsonb_build_object('deleted',a.id);
  else
   if jsonb_typeof(payload->'question') is distinct from 'string' or length(trim(payload->>'question')) not between 1 and 2000
    or jsonb_typeof(payload->'answer') is distinct from 'string' or length(payload->>'answer')>20000 then raise exception 'Question and answer required' using errcode='22023'; end if;
   insert into public.answer_library(id,user_id,question,answer,company_scope,provenance,verified_at,autofill_policy)
    values((payload->>'id')::uuid,owner_id,payload->>'question',payload->>'answer',nullif(payload->>'companyScope',''),'agent',null,'ask')
    on conflict(id) do update set question=excluded.question,answer=excluded.answer,company_scope=excluded.company_scope,provenance='agent',verified_at=null,autofill_policy='ask',updated_at=now()
    where answer_library.user_id=owner_id returning to_jsonb(answer_library) into result;
   if result is null then raise exception 'Owned answer not found' using errcode='P0002'; end if;
  end if;
 elsif operation like 'preferences.%' then
  select * into p from public.preferences where user_id=owner_id for update;
  if p.updated_at is distinct from expected then raise exception 'Preferences changed' using errcode='40001'; end if;
  if p.user_id is null then insert into public.preferences(user_id) values(owner_id) returning * into p; end if;
  if operation='preferences.tiers.save' then
   if jsonb_typeof(payload->'tierLists') is distinct from 'array' or jsonb_array_length(payload->'tierLists')>20 then raise exception 'Tier lists required' using errcode='22023'; end if;
   update public.preferences set tier_lists=payload->'tierLists',active_tier_list_id=payload->>'activeTierListId',updated_at=now() where user_id=owner_id;
  elsif operation='preferences.notifications.save' then
   if jsonb_typeof(payload->'settings') is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload->'settings') k where k not in ('quietMode','schedule')) then raise exception 'Notification settings only' using errcode='22023'; end if;
   update public.preferences set search=search||(payload->'settings'),updated_at=now() where user_id=owner_id;
  elsif operation='preferences.theme.save' then
   if jsonb_typeof(payload->'theme') is distinct from 'object' then raise exception 'Theme required' using errcode='22023'; end if;
   update public.preferences set theme=payload->'theme',updated_at=now() where user_id=owner_id;
  else
   if jsonb_typeof(payload->'resumeRules') is distinct from 'array' or jsonb_array_length(payload->'resumeRules')>50 then raise exception 'Rules required' using errcode='22023'; end if;
   if payload->>'defaultResumeId' is not null and not exists(select 1 from public.resumes where id=(payload->>'defaultResumeId')::uuid and user_id=owner_id) then raise exception 'Owned resume required' using errcode='P0002'; end if;
   update public.preferences set search=search||jsonb_build_object('defaultResumeId',payload->'defaultResumeId','resumeRules',payload->'resumeRules'),updated_at=now() where user_id=owner_id;
  end if;
  select to_jsonb(x) into result from public.preferences x where user_id=owner_id;
 elsif operation='jobs.list' then
  if (payload->>'limit')::integer not between 1 and 100 or (payload->>'offset')::integer<0 then raise exception 'Bounded pagination required' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select * from public.jobs order by discovered_at desc,id limit (payload->>'limit')::integer offset (payload->>'offset')::integer) x;
 elsif operation='batches.read' then
  select * into b from public.job_batches where user_id=owner_id and (payload->>'batchId' is null or id=(payload->>'batchId')::uuid) order by batch_date desc,created_at desc,id limit 1;
  if b.id is null then raise exception 'Owned batch not found' using errcode='P0002'; end if;
  result:=jsonb_build_object('batch',to_jsonb(b),'items',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('job',to_jsonb(j)) order by i.position),'[]') from public.batch_items i join public.jobs j on j.id=i.job_id where i.user_id=owner_id and i.batch_id=b.id));
 elsif operation='batches.item.mark' then
  if payload->>'action' not in ('opened','saved') then raise exception 'Choose opened or saved' using errcode='22023'; end if;
  update public.batch_items set opened_at=case when payload->>'action'='opened' then coalesce(opened_at,now()) else opened_at end,saved_at=case when payload->>'action'='saved' then coalesce(saved_at,now()) else saved_at end
   where user_id=owner_id and batch_id=(payload->>'batchId')::uuid and job_id=payload->>'jobId' returning to_jsonb(batch_items) into result;
  if result is null then raise exception 'Owned item not found' using errcode='P0002'; end if;
 elsif operation='leaderboard.read' then
  if (payload->>'limit')::integer not between 1 and 100 then raise exception 'Bounded limit required' using errcode='22023'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select alias,xp,streak,applications_count from public.leaderboard_entries where opted_in order by xp desc,alias limit (payload->>'limit')::integer) x;
 elsif operation='selection.reconsider.simple' then
  update public.selection_decisions set reconsidered_at=coalesce(reconsidered_at,now()) where id=(payload->>'id')::uuid and user_id=owner_id returning to_jsonb(selection_decisions) into result;
  if result is null then raise exception 'Owned selection not found' using errcode='P0002'; end if;
 else
  if payload->>'action' not in ('verify-profile','verify-answer','approve-application','resolve-submission','application-permission','community-sharing','manage-connections','sign-in','sign-out','configure-schedule','connect-social-source','send-outreach') then raise exception 'Unknown handoff' using errcode='22023'; end if;
  if payload->>'action' in ('approve-application','resolve-submission') and not exists(select 1 from public.applications where user_id=owner_id and id=(payload->>'recordId')::uuid) then raise exception 'Owned application required' using errcode='P0002'; end if;
  if payload->>'action'='verify-answer' and not exists(select 1 from public.answer_library where user_id=owner_id and id=(payload->>'recordId')::uuid) then raise exception 'Owned answer required' using errcode='P0002'; end if;
  result:=jsonb_build_object('requiresHuman',true,'action',payload->>'action','recordId',payload->'recordId','executed',false,
   'url','https://wcia013twe.github.io/codex-automated-job-board/'||case when payload->>'action' in ('approve-application','resolve-submission') then 'needs-you/' when payload->>'action'='send-outreach' then 'referrals/' else 'profile/' end,
   'instruction',case when payload->>'action' in ('configure-schedule','connect-social-source') then 'Use the linked preferences as context and configure this in your connected runtime. The board does not create schedules or grant external social access.' else 'Open the linked page and complete the requested action yourself. No approval, verification, permission, sharing or outreach action has been executed.' end);
 end if;
 return result;
end $$;
revoke all on function private.platform_actions_for_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.platform_actions_for_owner(uuid,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; required_scope text;
begin
 if operation not in ('profile.save','answers.save','answers.delete','preferences.tiers.save','preferences.notifications.save','preferences.theme.save','preferences.resumes.save','jobs.list','batches.read','batches.item.mark','leaderboard.read','selection.reconsider.simple','human.request') then return private.platform_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 required_scope:=case when operation='profile.save' then 'profile:write' when operation like 'answers.%' then 'answers:write' when operation like 'preferences.%' then 'preferences:write' when operation in ('batches.item.mark','selection.reconsider.simple') then 'activity:write' else 'workspace:read' end;
 if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 return private.platform_actions_for_owner(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('workspace:read','profile:write','answers:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
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

commit;
