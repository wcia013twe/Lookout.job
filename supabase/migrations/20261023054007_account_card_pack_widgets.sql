begin;
-- Widget setup is small account presentation metadata. Cards reuse private batches/jobs.
create function private.guard_card_pack_settings() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb:='{}'; cfg jsonb; p jsonb; ref text; old_version bigint:=0; new_version bigint;
begin
 if tg_op='UPDATE' then prior:=old.theme; end if;
 old_version:=coalesce((prior->>'cardPacksVersion')::bigint,0);
 if not new.theme ? 'cardPacks' then
  if prior ? 'cardPacks' then new.theme:=new.theme||jsonb_build_object('cardPacks',prior->'cardPacks','cardPacksVersion',old_version); end if;
  return new;
 end if;
 if jsonb_typeof(new.theme->'cardPacksVersion') is distinct from 'number' or (new.theme->>'cardPacksVersion') !~ '^[0-9]+$' then raise exception 'Current card pack version required' using errcode='22023'; end if;
 new_version:=(new.theme->>'cardPacksVersion')::bigint;
 -- Legacy full-workspace autosync cannot erase or roll back the separately versioned setup.
 if tg_op='UPDATE' and new_version<=old_version then
  new.theme:=new.theme||jsonb_build_object('cardPacks',coalesce(prior->'cardPacks','[]'),'cardPacksVersion',old_version);
  return new;
 end if;
 if new_version<>old_version+1 then raise exception 'Card pack settings changed' using errcode='40001'; end if;
 cfg:=new.theme->'cardPacks';
 if jsonb_typeof(cfg) is distinct from 'array' or jsonb_array_length(cfg)>8 or octet_length(cfg::text)>9000 then raise exception 'Bounded card packs required' using errcode='22023'; end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(cfg)) then raise exception 'Duplicate pack ID' using errcode='22023'; end if;
 for p in select value from jsonb_array_elements(cfg) loop
  if jsonb_typeof(p) is distinct from 'object' or not p ?& array['id','title','enabled','taskId'] or exists(select 1 from jsonb_object_keys(p) k where k not in ('id','title','enabled','taskId','archive'))
   or coalesce(p->>'id','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(p->'title') is distinct from 'string' or length(trim(p->>'title')) not between 1 and 80 or jsonb_typeof(p->'enabled') is distinct from 'boolean'
   or jsonb_typeof(p->'taskId') is distinct from 'string' or coalesce(p->>'taskId','') !~ '^[a-zA-Z0-9_-]{1,80}$'
   or p ? 'archive' and (jsonb_typeof(p->'archive') is distinct from 'string' or p->>'archive' not in ('none','zero2sudo')) then raise exception 'Invalid card pack setup' using errcode='22023'; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(new.search#>'{schedule,routines}','[]')) t where t->>'id'=p->>'taskId') then raise exception 'Existing My Agent task required' using errcode='22023'; end if;
  if p->>'archive'='zero2sudo' and not exists(select 1 from jsonb_array_elements(coalesce(new.search#>'{schedule,routines}','[]')) t where t->>'id'=p->>'taskId' and t->'sourceIds' ? 'zero2sudo') then raise exception 'Zero2Sudo task source required for archive' using errcode='22023'; end if;
 end loop;
 return new;
end $$;
revoke all on function private.guard_card_pack_settings() from public,anon,authenticated;
create trigger guard_card_pack_settings before insert or update of theme on public.preferences for each row execute function private.guard_card_pack_settings();

-- Task definitions reuse My Agent's existing schedule JSON. Once versioned,
-- legacy full-workspace autosync cannot roll back task assignments or instructions.
create function private.guard_automation_tasks() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb:='{}'; cfg jsonb; task jsonb; ref text; old_version bigint:=0; new_version bigint;
begin
 if tg_op='UPDATE' then prior:=coalesce(old.search->'schedule','{}'); end if;
 cfg:=new.search->'schedule';
 old_version:=coalesce((prior->>'configVersion')::bigint,0);
 if old_version>0 and (cfg is null or not cfg ? 'configVersion') then new.search:=new.search||jsonb_build_object('schedule',prior);return new;end if;
 if cfg is null or cfg='null'::jsonb then return new;end if;
 if cfg ? 'configVersion' then
  if jsonb_typeof(cfg->'configVersion') is distinct from 'number' or (cfg->>'configVersion') !~ '^[0-9]+$' then raise exception 'Task configVersion required' using errcode='22023';end if;
  new_version:=(cfg->>'configVersion')::bigint;
  if tg_op='UPDATE' and new_version<=old_version then new.search:=new.search||jsonb_build_object('schedule',prior);return new;end if;
  if new_version<>old_version+1 then raise exception 'Automation tasks changed' using errcode='40001';end if;
 end if;
 if jsonb_typeof(cfg) is distinct from 'object' or jsonb_typeof(cfg->'routines') is distinct from 'array' or jsonb_array_length(cfg->'routines')>30 or octet_length(cfg::text)>150000 or jsonb_typeof(cfg->'enabled') is distinct from 'boolean' or not exists(select 1 from pg_timezone_names where name=cfg->>'timezone') then raise exception 'Bounded tasks and valid time zone required' using errcode='22023';end if;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(cfg->'routines')) then raise exception 'Duplicate task ID' using errcode='22023';end if;
 for task in select value from jsonb_array_elements(cfg->'routines') loop
  if jsonb_typeof(task) is distinct from 'object' or jsonb_typeof(task->'id') is distinct from 'string' or coalesce(task->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' or jsonb_typeof(task->'enabled') is distinct from 'boolean'
   or task ? 'title' and (jsonb_typeof(task->'title') is distinct from 'string' or length(trim(task->>'title')) not between 1 and 120)
   or task ? 'description' and (jsonb_typeof(task->'description') is distinct from 'string' or length(task->>'description')>4000)
   or task ? 'mode' and coalesce(task->>'mode','') not in ('manual','scheduled')
   or coalesce(task->>'mode','scheduled')<>'manual' and coalesce(task->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid automation task' using errcode='22023';end if;
  if task ? 'sourceIds' or task ? 'connectionIds' then
   if new_version is null then raise exception 'Version required for task assignments' using errcode='22023';end if;
   if jsonb_typeof(task->'sourceIds') is distinct from 'array' or jsonb_array_length(task->'sourceIds')>8 or jsonb_typeof(task->'connectionIds') is distinct from 'array' or jsonb_array_length(task->'connectionIds')>4 then raise exception 'Bounded task assignments required' using errcode='22023';end if;
   if (select count(*)<>count(distinct value) from jsonb_array_elements(task->'sourceIds')) or (select count(*)<>count(distinct value) from jsonb_array_elements(task->'connectionIds')) then raise exception 'Duplicate task assignments' using errcode='22023';end if;
   for ref in select jsonb_array_elements_text(task->'sourceIds') loop
    if ref !~ '^[a-zA-Z0-9_-]{1,80}$' or not exists(select 1 from jsonb_array_elements(coalesce(new.search->'targets','[]')) src where src->>'id'=ref) then raise exception 'Owned task source required' using errcode='22023';end if;
   end loop;
   for ref in select jsonb_array_elements_text(task->'connectionIds') loop
    if ref !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' or not exists(select 1 from private.agent_connections c where c.id=ref::uuid and c.user_id=new.user_id) then raise exception 'Owned task connection required' using errcode='42501';end if;
   end loop;
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.guard_automation_tasks() from public,anon,authenticated;
create trigger guard_automation_tasks before insert or update of search on public.preferences for each row execute function private.guard_automation_tasks();

-- Narrow canonical settings writer works on hosted projects that have not yet
-- installed the broader platform-action service. No arbitrary database operations.
create function private.configure_card_pack_preferences(owner_id uuid, operation text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.preferences; expected timestamptz;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='28000';end if;
 if operation not in ('preferences.theme.save','preferences.notifications.save') then raise exception 'Task or widget preferences only' using errcode='22023';end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ? 'expectedUpdatedAt' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('expectedUpdatedAt',case when operation='preferences.theme.save' then 'theme' else 'settings' end)) then raise exception 'Settings and expectedUpdatedAt required' using errcode='22023';end if;
 expected:=(payload->>'expectedUpdatedAt')::timestamptz;
 -- Serializes first creation as well as edits to an existing preferences row.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,86));
 select * into p from public.preferences where user_id=owner_id for update;
 if p.updated_at is distinct from expected then raise exception 'Preferences changed' using errcode='40001';end if;
 if p.user_id is null then insert into public.preferences(user_id) values(owner_id);end if;
 if operation='preferences.theme.save' then
  if jsonb_typeof(payload->'theme') is distinct from 'object' then raise exception 'Theme required' using errcode='22023';end if;
  update public.preferences set theme=payload->'theme',updated_at=clock_timestamp() where user_id=owner_id;
 else
  if jsonb_typeof(payload->'settings') is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload->'settings') k where k not in ('schedule','quietMode')) then raise exception 'Task schedule or notification settings only' using errcode='22023';end if;
  update public.preferences set search=search||(payload->'settings'),updated_at=clock_timestamp() where user_id=owner_id;
 end if;
 select * into p from public.preferences where user_id=owner_id;
 return to_jsonb(p);
end $$;
revoke all on function private.configure_card_pack_preferences(uuid,text,jsonb) from public,anon,authenticated;
create function public.configure_card_pack_preferences(operation text,payload jsonb) returns jsonb
language sql security definer set search_path='' as $$
 select private.configure_card_pack_preferences(auth.uid(),operation,payload);
$$;
revoke all on function public.configure_card_pack_preferences(text,jsonb) from public,anon;
grant execute on function public.configure_card_pack_preferences(text,jsonb) to authenticated;
create function private.configure_card_pack_agent(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'preferences:write'=any(c.scopes) then raise exception 'preferences:write required' using errcode='42501';end if;
 return private.configure_card_pack_preferences(c.user_id,operation,payload);
end $$;
revoke all on function private.configure_card_pack_agent(text,text,jsonb) from public,anon,authenticated;

-- Existing publish_batch tool remains the writer. Pack routing is checked against the
-- authenticated connection, not an agent-supplied publisher name or browser flag.
create function private.prepare_card_pack_batch(credential_hash text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; cfg jsonb; task jsonb; pack_id text; job jsonb; jobs jsonb:='[]'; settings public.preferences;
begin
 if jsonb_typeof(payload->'jobs')='array' and exists(select 1 from jsonb_array_elements(payload->'jobs') j where j->'recommendation' ? 'cardPackId') then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if c.user_id is null or not 'batches:write'=any(c.scopes) then raise exception 'batches:write required' using errcode='42501'; end if;
  select * into settings from public.preferences where user_id=c.user_id for share;
  pack_id:=payload#>>'{jobs,0,recommendation,cardPackId}';
  select value into cfg from jsonb_array_elements(coalesce(settings.theme->'cardPacks','[]')) where value->>'id'=pack_id;
  if cfg is null then raise exception 'Owned card pack not found' using errcode='P0002'; end if;
  select value into task from jsonb_array_elements(coalesce(settings.search#>'{schedule,routines}','[]')) where value->>'id'=cfg->>'taskId';
  if task is null then raise exception 'Linked My Agent task not found' using errcode='P0002';end if;
  if not (cfg->>'enabled')::boolean or not (task->>'enabled')::boolean or not coalesce(task->'connectionIds','[]') ? c.id::text then raise exception 'This connection is not assigned to the enabled task and pack' using errcode='42501'; end if;
  for job in select value from jsonb_array_elements(payload->'jobs') loop
   if job#>>'{recommendation,cardPackId}' is distinct from pack_id or coalesce(job#>>'{recommendation,sourceId}','') !~ '^[a-zA-Z0-9_-]{1,80}$' or not coalesce(task->'sourceIds','[]') ? (job#>>'{recommendation,sourceId}')
    or not exists(select 1 from jsonb_array_elements(coalesce(settings.search->'targets','[]')) s where s->>'id'=job#>>'{recommendation,sourceId}')
    or job->'recommendation' ? 'dropStatus' and (jsonb_typeof(job#>'{recommendation,dropStatus}') is distinct from 'string' or job#>>'{recommendation,dropStatus}' not in ('added','pending','skipped'))
    or exists(select 1 from jsonb_each(job->'recommendation') e where e.key in ('note','skipReason') and e.value<>'null'::jsonb and (jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>4000)) then raise exception 'Each card needs the same pack and a configured source' using errcode='22023'; end if;
   jobs:=jobs||jsonb_build_array(jsonb_set(job,'{recommendation}',job->'recommendation'||jsonb_build_object('publisherConnectionId',c.id,'automationTaskId',task->>'id')));
  end loop;
  if length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 then raise exception 'Batch event key required' using errcode='22023'; end if;
  payload:=payload||jsonb_build_object('jobs',jobs,'eventKey','card-pack:'||pack_id||':'||md5(payload->>'eventKey'));
 elsif coalesce(payload->>'eventKey','') like 'card-pack:%' then
  raise exception 'Card pack event keys are server assigned' using errcode='22023';
 end if;
 return payload;
end $$;
revoke all on function private.prepare_card_pack_batch(text,jsonb) from public,anon,authenticated;
grant execute on function private.prepare_card_pack_batch(text,jsonb) to service_role;
-- Add the hook to the installed dispatcher without adding another delegation layer
-- or replacing older deployments with unrelated, not-yet-deployed operations.
do $install$
declare definition text; body text; patched text;
begin
 select pg_get_functiondef(p.oid),p.prosrc into definition,body from pg_proc p where p.oid='public.agent_dispatch(text,text,jsonb)'::regprocedure;
 if position('private.prepare_card_pack_batch' in body)>0 then raise exception 'Pack hook already installed'; end if;
 patched:=regexp_replace(body,E'\\m[Bb][Ee][Gg][Ii][Nn]\\M',E'begin\n if operation in (''preferences.theme.save'',''preferences.notifications.save'') then return private.configure_card_pack_agent(credential_hash,operation,payload);end if;\n if operation=''batches.publish'' then payload:=private.prepare_card_pack_batch(credential_hash,payload);end if;');
 if patched=body then raise exception 'Dispatcher body not recognized';end if;
 execute replace(definition,body,patched);
end $install$;
comment on function private.guard_card_pack_settings() is 'Versioned optional card packs in preferences.theme; linked My Agent task, no new catalog or widget table.';
commit;
