begin;
-- Reconcile dispatch links and restore current preference/connection protections after
-- older missing migrations are applied to the hosted deployment. Definitions match
-- the complete chronological migration chain. No account records are rewritten.

CREATE OR REPLACE FUNCTION private.company_previous_dispatch(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c private.agent_connections; d public.search_documents; response jsonb; already_recorded boolean; portals jsonb;
begin
 if operation not like 'search.%' and not (operation='toolkit.record' and payload->>'kind'='source_config') then return private.search_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
 -- Reuse the existing source_config operation for one atomic, replayable write.
 if operation='toolkit.record' then
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,71));
  select exists(select 1 from public.career_toolkit_results where user_id=c.user_id and event_key=payload->>'eventKey') into already_recorded;
  response:=private.search_previous(credential_hash,operation,payload);
  if not already_recorded then
   select * into d from public.search_documents where user_id=c.user_id and kind='portals' and id='shared' for update;
   if not found then raise exception 'Save canonical portals first' using errcode='P0002';end if;
   select d.projection||jsonb_build_object('tracked_companies',jsonb_agg(case when source->>'id'=payload->'result'->>'targetId' then (source-array['provider','api','keywords'])||(payload->'result'->'options')||jsonb_build_object('provider',payload->'result'->>'provider') else source end)) into portals from jsonb_array_elements(d.projection->'tracked_companies') source;
   perform private.write_search_document(c.user_id,'portals','shared',d.version,portals::text);
  end if;
  return response;
 end if;
 if operation in ('search.document.save','search.request') and not 'preferences:write'=any(c.scopes) or operation in ('search.run.start','search.progress','search.discoveries.save','search.screening.save','search.run.finish') and not 'drafts:write'=any(c.scopes) then raise exception 'Write scope required' using errcode='42501';end if;
 return private.search_owned(c.user_id,operation,payload);
end $function$;

CREATE OR REPLACE FUNCTION private.extended_platform_dispatch_previous(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c private.agent_connections;
begin
 if operation<>'preferences.targets.save' then return private.search_targets_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'preferences:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('expectedVersion','targets')) then raise exception 'Invalid arguments' using errcode='22023'; end if;
 return private.save_search_targets_for_owner(c.user_id,(payload->>'expectedVersion')::integer,payload->'targets');
end $function$;

CREATE OR REPLACE FUNCTION private.knowledge_previous_dispatch(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c private.agent_connections; needed text;
begin
 if operation not like 'onboarding.%' and operation not like 'tasks.%' then return private.onboarding_previous_dispatch(credential_hash,operation,payload); end if;
 perform private.onboarding_previous_dispatch(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 needed:=case when operation in ('onboarding.get_state','tasks.read') then 'workspace:read' else 'preferences:write' end;
 if not ('workspace:read'=any(c.scopes)) or not needed=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation in ('tasks.claim','tasks.report_result') then
  if exists(select 1 from private.agent_tasks where id=(payload->>'taskId')::uuid and user_id=c.user_id and kind='prepare_application') and not ('drafts:write'=any(c.scopes)) then raise exception 'Draft scope required' using errcode='42501'; end if;
 end if;
 return private.onboarding_action(c.user_id,operation,payload,c.id);
end $function$;

CREATE OR REPLACE FUNCTION private.onboarding_previous_dispatch(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare c private.agent_connections; required_scope text;
begin
 if operation not in ('contacts.read','contacts.save','contacts.delete','resumes.reference.add','applications.progress','resumes.upload.begin','resumes.upload.context','resumes.upload.finalize') then return private.extended_platform_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 required_scope:=case when operation like 'resumes.%' then 'resumes:write' when operation in ('contacts.save','contacts.delete') then 'network:write' when operation='applications.progress' then 'tracking:write' else 'workspace:read' end;
 if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 return private.extended_actions_for_owner(c.user_id,operation,payload);
end $function$;

CREATE OR REPLACE FUNCTION private.platform_dispatch_previous(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c private.agent_connections; a public.applications; result jsonb; needed text;
begin
 if operation not in ('applications.timeline','applications.milestone','applications.record','workspace.read') then return private.milestones_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 needed:=case when operation='applications.milestone' then 'activity:write' else 'workspace:read' end;
 if not needed=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation='workspace.read' then
  result:=private.milestones_dispatch_previous(credential_hash,operation,payload);
  return result||jsonb_build_object('milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from public.application_milestones m where m.user_id=c.user_id));
 end if;
 select * into a from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if operation='applications.milestone' then
  return to_jsonb(private.record_application_milestone_owned(c.user_id,a.id,payload-'applicationId','email'));
 end if;
 result:=case when operation='applications.record' then private.milestones_dispatch_previous(credential_hash,operation,payload) else jsonb_build_object('application',to_jsonb(a)) end;
 return result||jsonb_build_object('milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from public.application_milestones m where m.user_id=c.user_id and m.application_id=a.id));
end $function$;

CREATE OR REPLACE FUNCTION private.save_preferences_authenticated(search_next jsonb, lists_next jsonb, active_next text, theme_next jsonb)
 RETURNS preferences
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.preferences; next_search jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(search_next) is distinct from 'object' or jsonb_typeof(lists_next) is distinct from 'array' or jsonb_typeof(theme_next) is distinct from 'object'
  or octet_length(search_next::text)>100000 or octet_length(lists_next::text)>1000000 or octet_length(theme_next::text)>10000
 then raise exception 'Invalid preferences' using errcode='22023'; end if;
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into p from public.preferences where user_id=auth.uid() for update;
 next_search:=search_next-array['quietMode','profiles','targets','targetsVersion','onboarding','deliveryRequest'];
 next_search:=next_search||(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(p.search,'{}')) where key in ('quietMode','profiles','targets','targetsVersion','onboarding','deliveryRequest'));
 update public.preferences set search=next_search,tier_lists=lists_next,active_tier_list_id=active_next,theme=theme_next,updated_at=now()
 where user_id=auth.uid() returning * into p;
 return p;
end $function$;

CREATE OR REPLACE FUNCTION private.search_targets_dispatch_previous(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare c private.agent_connections; required_scope text;
begin
 if operation not in ('profile.save','answers.save','answers.delete','preferences.tiers.save','preferences.notifications.save','preferences.theme.save','preferences.resumes.save','jobs.list','batches.read','batches.item.mark','leaderboard.read','selection.reconsider.simple','human.request') then return private.platform_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 required_scope:=case when operation='profile.save' then 'profile:write' when operation like 'answers.%' then 'answers:write' when operation like 'preferences.%' then 'preferences:write' when operation in ('batches.item.mark','selection.reconsider.simple') then 'activity:write' else 'workspace:read' end;
 if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 return private.platform_actions_for_owner(c.user_id,operation,payload);
end $function$;

CREATE OR REPLACE FUNCTION private.toolkit_previous(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c private.agent_connections; needed text;
begin
 if operation not in ('preparation.planner.read','preparation.budget','preparation.session.complete') then return private.preparation_planner_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 needed:=case when operation='preparation.budget' then 'preferences:write' when operation='preparation.session.complete' then 'drafts:write' else 'workspace:read' end;
 if not needed=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation='preparation.planner.read' then return private.preparation_planner_read_owned(c.user_id);
 elsif operation='preparation.budget' then return private.preparation_budget_owned(c.user_id,(payload->>'dailyMinutes')::integer,(payload->>'expectedVersion')::integer);
 else return private.preparation_session_owned(c.user_id,(payload->>'sessionId')::uuid,(payload->>'minutes')::integer,payload->'targets'); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.agent_dispatch(credential_hash text, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c private.agent_connections; needed text;
begin
 if operation in ('preferences.theme.save','preferences.notifications.save') then return private.configure_card_pack_agent(credential_hash,operation,payload);end if;
 if operation='batches.publish' then payload:=private.prepare_card_pack_batch(credential_hash,payload);end if;
 if operation in ('brief.read','profile.fields.update','company_workspaces.fields.update','contacts.fields.update','artifacts.fields.update') then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  needed:=case operation when 'brief.read' then 'workspace:read' when 'profile.fields.update' then 'profile:write' when 'artifacts.fields.update' then 'drafts:write' else 'network:write' end;
  if c.user_id is null or not needed=any(c.scopes) or (operation='artifacts.fields.update' and not 'workspace:read'=any(c.scopes)) then raise exception 'Required scope missing' using errcode='42501';end if;
  if operation='brief.read' then return private.user_brief_snapshot(c.user_id,payload);end if;
  return private.update_owned_fields(c.user_id,operation,payload);
 end if;
 if operation='resumes.source.replace' then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if c.user_id is null or not ('resumes:write'=any(c.scopes) and 'preferences:write'=any(c.scopes)) then raise exception 'Resume and preference write scopes required' using errcode='42501';end if;
  return private.replace_resume_source_owned(c.user_id,payload);
 end if;
 if operation not like 'artifacts.%' and operation not like 'learning.%' then return private.artifact_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'workspace:read'=any(c.scopes) or (operation in ('artifacts.save','artifacts.archive','learning.save') and not 'drafts:write'=any(c.scopes)) then raise exception 'Artifact scope required' using errcode='42501';end if;
 return private.artifact_owned(c.user_id,operation,payload);
end $function$;

CREATE OR REPLACE FUNCTION public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
#variable_conflict use_variable
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 19));
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(coalesce(payload->>'name',''))) not between 1 and 80
      or coalesce(payload->>'tokenHash','') !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') is distinct from 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('knowledge:read','knowledge:write','workspace:read','profile:write','answers:write','network:write','tracking:write','resumes:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
      then raise exception 'Invalid connection' using errcode='22023'; end if;
    -- Limits accidental repeated provisioning; revoked/expired entries do not count.
    if (select count(*) from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now()) >= 10 then
      raise exception 'Revoke an existing connection first' using errcode='22023';
    end if;
    insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
      values(owner_id,trim(payload->>'name'),payload->>'tokenHash',array(select jsonb_array_elements_text(payload->'scopes')),now()+make_interval(days=>days)) returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.profile_setup' then
    if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Enabled boolean required' using errcode='22023'; end if;
    select * into connection from private.agent_connections where user_id=owner_id and id=(payload->>'id')::uuid and revoked_at is null and expires_at>now() for update;
    if not found then raise exception 'Active owned connection not found' using errcode='P0002'; end if;
    update private.agent_connections set scopes=case when (payload->>'enabled')::boolean then
      array(select distinct s from unnest(connection.scopes || array['profile:write']) s) else array_remove(connection.scopes,'profile:write') end
      where id=connection.id returning * into connection;
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
end $function$;

-- Preserve the service-only gateway boundary after replacing dispatch definitions.
revoke all on function public.agent_dispatch(text, text, jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text, text, jsonb) to service_role;
revoke all on function public.manage_agent_connection(uuid, text, jsonb) from public,anon,authenticated;
grant execute on function public.manage_agent_connection(uuid, text, jsonb) to service_role;
commit;
