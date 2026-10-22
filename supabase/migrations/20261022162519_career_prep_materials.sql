begin;
create table public.career_artifacts (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 version integer not null default 1 check(version>0), archived boolean not null default false,
 content jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index career_artifact_owner_date on public.career_artifacts(user_id,updated_at desc,id);
create table public.career_artifact_revisions (
 artifact_id uuid not null references public.career_artifacts on delete cascade,
 user_id uuid not null references auth.users on delete cascade, version integer not null,
 content jsonb not null, archived boolean not null, created_at timestamptz not null default now(),
 primary key(artifact_id,version)
);
create table public.learning_goals (
 id uuid primary key, user_id uuid not null references auth.users on delete cascade,
 version integer not null default 1 check(version>0), goal jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.career_artifacts enable row level security;
alter table public.career_artifact_revisions enable row level security;
alter table public.learning_goals enable row level security;
revoke all on public.career_artifacts,public.career_artifact_revisions,public.learning_goals from public,anon,authenticated;
grant select on public.career_artifacts,public.career_artifact_revisions,public.learning_goals to authenticated;
grant all on public.career_artifacts,public.career_artifact_revisions,public.learning_goals to service_role;
create policy artifact_owner_read on public.career_artifacts for select to authenticated using(user_id=(select auth.uid()));
create policy artifact_revision_owner_read on public.career_artifact_revisions for select to authenticated using(user_id=(select auth.uid()));
create policy learning_goal_owner_read on public.learning_goals for select to authenticated using(user_id=(select auth.uid()));
create function private.artifact_response(r public.career_artifacts) returns jsonb language sql immutable set search_path='' as $$
 select to_jsonb(r)||jsonb_build_object('path','/career-toolkit/?artifact='||r.id,'versionPath','/career-toolkit/?artifact='||r.id||'&version='||r.version,'url','https://wcia013twe.github.io/codex-automated-job-board/career-toolkit/?artifact='||r.id,'versionUrl','https://wcia013twe.github.io/codex-automated-job-board/career-toolkit/?artifact='||r.id||'&version='||r.version)
$$;
create function private.valid_artifact_date(v text) returns boolean language plpgsql immutable set search_path='' as $$
begin return v is not null and v ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and v::date::text=v;
exception when others then return false;end $$;
create function private.valid_artifact_source(v text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(length(v)<=2048 and v ~ '^https://[^/@[:space:]]+[^[:space:]]*$' and split_part(substr(v,9),'/',1) not like '%@%',false)
$$;
create function private.validate_artifact_content(owner_id uuid,doc jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; parent_id uuid;
begin
 if jsonb_typeof(doc) is distinct from 'object' or doc-array['title','purpose','kind','format','body','weekOf','company','sources','links']<>'{}'
  or jsonb_typeof(doc->'title') is distinct from 'string' or length(trim(doc->>'title')) not between 1 and 200
  or jsonb_typeof(doc->'purpose') is distinct from 'string' or length(trim(doc->>'purpose')) not between 1 and 1000
  or jsonb_typeof(doc->'body') is distinct from 'string' or length(trim(doc->>'body')) not between 1 and 150000
  or coalesce(doc->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes')
  or coalesce(doc->>'format','') not in ('markdown','html')
  or jsonb_typeof(doc->'sources') is distinct from 'array' or jsonb_array_length(doc->'sources')>30
  or jsonb_typeof(doc->'links') is distinct from 'array' or jsonb_array_length(doc->'links')>50
  or (doc ? 'weekOf' and (jsonb_typeof(doc->'weekOf') is distinct from 'string' or not private.valid_artifact_date(doc->>'weekOf')))
  or (doc ? 'company' and (jsonb_typeof(doc->'company') is distinct from 'string' or length(doc->>'company')>200))
 then raise exception 'Invalid artifact content' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(doc->'sources') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['title','url','observedAt']<>'{}' or jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or jsonb_typeof(item->'url') is distinct from 'string' or not private.valid_artifact_source(item->>'url') or jsonb_typeof(item->'observedAt') is distinct from 'string' or not private.valid_artifact_date(item->>'observedAt') then raise exception 'Dated HTTPS sources required' using errcode='22023';end if;
 end loop;
 for item in select value from jsonb_array_elements(doc->'links') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['applicationId','goalId','taskId']<>'{}' or (item ? 'applicationId')=(item ? 'goalId') or jsonb_typeof(item->'taskId') is distinct from 'string' or length(trim(item->>'taskId')) not between 1 and 200 then raise exception 'Invalid task link' using errcode='22023';end if;
  parent_id:=coalesce(item->>'applicationId',item->>'goalId')::uuid;
  if item ? 'applicationId' then
   if not exists(select 1 from public.preparation_plans p,jsonb_array_elements(p.plan->'tasks') t where p.user_id=owner_id and p.application_id=parent_id and t->>'id'=item->>'taskId') then raise exception 'Owned interview task required' using errcode='P0002';end if;
  else
   if not exists(select 1 from public.learning_goals g,jsonb_array_elements(g.goal->'tasks') t where g.user_id=owner_id and g.id=parent_id and t->>'id'=item->>'taskId') then raise exception 'Owned learning task required' using errcode='P0002';end if;
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(doc->'links'))<>(select count(distinct (coalesce(value->>'applicationId',value->>'goalId'),value->>'taskId')) from jsonb_array_elements(doc->'links')) then raise exception 'Duplicate task links' using errcode='22023';end if;
end $$;
create function private.artifact_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.career_artifacts; previous public.learning_goals; saved public.learning_goals;
 doc jsonb; item jsonb; old_task jsonb; next_tasks jsonb:='[]'; item_id uuid; expected integer; requested_version integer; result jsonb; off integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Object required' using errcode='22023';end if;
 if operation='learning.read' then
  if payload<>'{}' then raise exception 'Unknown argument' using errcode='22023';end if;
  return (select coalesce(jsonb_agg(to_jsonb(g) order by updated_at desc,id),'[]') from public.learning_goals g where user_id=owner_id);
 elsif operation='artifacts.list' then
  if payload-array['query','kind','weekOf','applicationId','goalId','archived','offset']<>'{}' or (payload ? 'query' and (jsonb_typeof(payload->'query') is distinct from 'string' or length(payload->>'query')>200)) or (payload ? 'archived' and jsonb_typeof(payload->'archived') is distinct from 'boolean') or (payload ? 'offset' and (jsonb_typeof(payload->'offset') is distinct from 'number' or payload->>'offset' !~ '^[0-9]+$')) or (payload ? 'weekOf' and not private.valid_artifact_date(payload->>'weekOf')) then raise exception 'Invalid artifact filters' using errcode='22023';end if;
  if payload ? 'kind' and coalesce(payload->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes') then raise exception 'Unknown artifact kind' using errcode='22023';end if;
  if payload ? 'applicationId' then item_id:=(payload->>'applicationId')::uuid;end if;
  if payload ? 'goalId' then item_id:=(payload->>'goalId')::uuid;end if;
  off:=coalesce((payload->>'offset')::integer,0);if off not between 0 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(q.item order by q.updated_at desc,q.id),'[]') into result from (
   select (private.artifact_response(a)-'content')||jsonb_build_object('content',content-'body') as item,updated_at,id
   from public.career_artifacts a where user_id=owner_id and archived=coalesce((payload->>'archived')::boolean,false)
   and (not payload ? 'query' or position(lower(payload->>'query') in lower((content->>'title')||' '||(content->>'purpose')||' '||coalesce(content->>'company','')||' '||(content->>'body')))>0)
   and (not payload ? 'kind' or content->>'kind'=payload->>'kind') and (not payload ? 'weekOf' or content->>'weekOf'=payload->>'weekOf')
   and (not payload ? 'applicationId' or exists(select 1 from jsonb_array_elements(content->'links') l where l->>'applicationId'=payload->>'applicationId'))
   and (not payload ? 'goalId' or exists(select 1 from jsonb_array_elements(content->'links') l where l->>'goalId'=payload->>'goalId'))
   order by updated_at desc,id limit 26 offset off
  ) q;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextOffset',case when jsonb_array_length(result)>25 then off+25 else null end);
 elsif operation='artifacts.read' then
  if payload-array['id','version']<>'{}' then raise exception 'Unknown read argument' using errcode='22023';end if;
  select * into r from public.career_artifacts where user_id=owner_id and id=(payload->>'id')::uuid;
  if not found then raise exception 'Owned artifact required' using errcode='P0002';end if;
  if payload ? 'version' then
   if jsonb_typeof(payload->'version') is distinct from 'number' or payload->>'version' !~ '^[1-9][0-9]*$' then raise exception 'Revision required' using errcode='22023';end if;
   requested_version:=(payload->>'version')::integer;
   select content,version,archived,created_at into r.content,r.version,r.archived,r.updated_at from public.career_artifact_revisions where user_id=owner_id and artifact_id=r.id and version=requested_version;
   if not found then raise exception 'Revision not found' using errcode='P0002';end if;
  end if;
  return private.artifact_response(r)||jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'title',content->>'title','created_at',created_at) order by version desc),'[]') from (select * from public.career_artifact_revisions where user_id=owner_id and artifact_id=r.id order by version desc limit 50) z));
 end if;
 if operation not in ('artifacts.save','artifacts.archive','learning.save') then raise exception 'Unknown artifact operation' using errcode='22023';end if;
 if jsonb_typeof(payload->'id') is distinct from 'string' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or payload->>'expectedVersion' !~ '^[0-9]+$' then raise exception 'ID and current version required' using errcode='22023';end if;
 item_id:=(payload->>'id')::uuid;expected:=(payload->>'expectedVersion')::integer;
 if item_id is null or expected>2147483646 then raise exception 'Invalid version' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(item_id::text,82));
 if operation='learning.save' then
  doc:=payload-array['id','expectedVersion'];
  if doc-array['title','objective','active','tasks']<>'{}' or jsonb_typeof(doc->'title') is distinct from 'string' or length(trim(doc->>'title')) not between 1 and 200 or jsonb_typeof(doc->'objective') is distinct from 'string' or length(trim(doc->>'objective')) not between 1 and 2000 or jsonb_typeof(doc->'active') is distinct from 'boolean' or jsonb_typeof(doc->'tasks') is distinct from 'array' or jsonb_array_length(doc->'tasks')>30 then raise exception 'Invalid learning goal' using errcode='22023';end if;
  select * into previous from public.learning_goals where id=item_id for update;
  if found and previous.user_id<>owner_id then raise exception 'Owned goal required' using errcode='P0002';end if;
  for item in select value from jsonb_array_elements(doc->'tasks') loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['id','title','detail','minutes','targetDate']<>'{}' or jsonb_typeof(item->'id') is distinct from 'string' or length(trim(item->>'id')) not between 1 and 100 or jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or jsonb_typeof(item->'detail') is distinct from 'string' or length(item->>'detail')>2000 or jsonb_typeof(item->'minutes') is distinct from 'number' or item->>'minutes' !~ '^[0-9]+$' or (item->>'minutes')::integer not between 1 and 240 or jsonb_typeof(item->'targetDate') is distinct from 'string' or not private.valid_artifact_date(item->>'targetDate') then raise exception 'Invalid dated learning task' using errcode='22023';end if;
   select value into old_task from jsonb_array_elements(coalesce(previous.goal->'tasks','[]')) where value->>'id'=item->>'id';
   if old_task->>'completed'='true' then item:=old_task;
   else
    if old_task is not null and exists(select 1 from public.preparation_sessions s,jsonb_array_elements(s.targets) t where s.user_id=owner_id and t->>'goalId'=item_id::text and t->>'taskId'=item->>'id') then item:=item||jsonb_build_object('minutes',old_task->'minutes');end if;
    item:=item||jsonb_build_object('completed',false);
   end if;
   next_tasks:=next_tasks||jsonb_build_array(item);
  end loop;
  if jsonb_array_length(next_tasks)<>(select count(distinct value->>'id') from jsonb_array_elements(next_tasks)) then raise exception 'Duplicate task IDs' using errcode='22023';end if;
  for old_task in select value from jsonb_array_elements(coalesce(previous.goal->'tasks','[]')) loop
   if old_task->>'completed'='true' and not exists(select 1 from jsonb_array_elements(next_tasks) t where t->>'id'=old_task->>'id') then next_tasks:=next_tasks||jsonb_build_array(old_task);end if;
  end loop;
  doc:=jsonb_set(doc,'{tasks}',next_tasks);
  if previous.id is not null then
   if previous.version=expected+1 and previous.goal=doc then return to_jsonb(previous);end if;
   if previous.version<>expected then raise exception 'Goal changed; reload' using errcode='40001';end if;
   update public.learning_goals set goal=doc,version=version+1,updated_at=now() where id=item_id returning * into saved;
  else
   if expected<>0 then raise exception 'Goal changed; reload' using errcode='40001';end if;
   insert into public.learning_goals(id,user_id,goal) values(item_id,owner_id,doc) returning * into saved;
  end if;
  return to_jsonb(saved);
 end if;
 select * into r from public.career_artifacts where id=item_id for update;
 if r.id is not null and r.user_id<>owner_id then raise exception 'Owned artifact required' using errcode='P0002';end if;
 if operation='artifacts.archive' then
  if payload-array['id','expectedVersion','archived']<>'{}' or jsonb_typeof(payload->'archived') is distinct from 'boolean' then raise exception 'Archive flag required' using errcode='22023';end if;
  if r.id is null then raise exception 'Owned artifact required' using errcode='P0002';end if;
  if r.version=expected+1 and r.archived=(payload->>'archived')::boolean then return private.artifact_response(r);end if;
  if r.version<>expected then raise exception 'Artifact changed; reload' using errcode='40001';end if;
  update public.career_artifacts set archived=(payload->>'archived')::boolean,version=version+1,updated_at=now() where id=item_id returning * into r;
 else
  doc:=payload-array['id','expectedVersion'];
  if r.id is not null and r.version=expected+1 and r.content=doc then return private.artifact_response(r);end if;
  perform private.validate_artifact_content(owner_id,doc);
  if r.id is not null then
   if r.version=expected+1 and r.content=doc then return private.artifact_response(r);end if;
   if r.version<>expected then raise exception 'Artifact changed; reload' using errcode='40001';end if;
   update public.career_artifacts set content=doc,version=version+1,updated_at=now() where id=item_id returning * into r;
  else
   if expected<>0 then raise exception 'Artifact changed; reload' using errcode='40001';end if;
   insert into public.career_artifacts(id,user_id,content) values(item_id,owner_id,doc) returning * into r;
  end if;
 end if;
 insert into public.career_artifact_revisions(artifact_id,user_id,version,content,archived) values(r.id,owner_id,r.version,r.content,r.archived);
 return private.artifact_response(r);
end $$;
revoke all on function private.artifact_response(public.career_artifacts),private.valid_artifact_date(text),private.valid_artifact_source(text),private.validate_artifact_content(uuid,jsonb),private.artifact_owned(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.artifact_owned(uuid,text,jsonb) to service_role;
create function public.artifact_action(operation text,payload jsonb) returns jsonb language sql security definer set search_path='' as $$ select private.artifact_owned(auth.uid(),operation,payload) $$;
revoke all on function public.artifact_action(text,jsonb) from public,anon;
grant execute on function public.artifact_action(text,jsonb) to authenticated;

-- Extend the canonical planner snapshot, keeping one budget and one immutable session ledger.
alter function private.preparation_planner_read_owned(uuid) rename to preparation_planner_before_artifacts;
create function private.preparation_planner_read_owned(owner_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.preparation_planner_before_artifacts(owner_id)||jsonb_build_object(
 'learningGoals',(select coalesce(jsonb_agg(to_jsonb(g) order by id),'[]') from public.learning_goals g where user_id=owner_id),
 'artifacts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'title',content->>'title','links',content->'links','path','/career-toolkit/?artifact='||id) order by id),'[]') from public.career_artifacts where user_id=owner_id and not archived))
$$;
revoke all on function private.preparation_planner_read_owned(uuid) from public,anon,authenticated;
grant execute on function private.preparation_planner_read_owned(uuid) to service_role;
create or replace function private.preparation_session_owned(owner_id uuid, session_id uuid, session_minutes integer, session_targets jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.preparation_sessions; settings public.preparation_planner_settings;
 target jsonb; p public.preparation_plans; g public.learning_goals; task jsonb; zone text; spent integer; next_tasks jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if session_id is null or session_minutes is null or session_minutes not between 1 and 240
  or jsonb_typeof(session_targets) is distinct from 'array' or jsonb_array_length(session_targets) not between 1 and 100
 then raise exception 'Invalid preparation session' using errcode='22023'; end if;
 insert into public.preparation_planner_settings(user_id) values(owner_id) on conflict(user_id) do nothing;
 select * into settings from public.preparation_planner_settings where user_id=owner_id for update;
 select * into previous from public.preparation_sessions where id=session_id;
 if found then
  if previous.user_id<>owner_id or previous.minutes<>session_minutes or previous.targets<>session_targets then raise exception 'Session ID already used' using errcode='22023'; end if;
  return private.preparation_planner_read_owned(owner_id);
 end if;
 zone:=coalesce((select search->'quietMode'->>'timezone' from public.preferences where user_id=owner_id),'UTC');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='UTC'; end if;
 select coalesce(sum(minutes),0) into spent from public.preparation_sessions where user_id=owner_id and (completed_at at time zone zone)::date=(now() at time zone zone)::date;
 if spent+session_minutes>settings.daily_minutes then raise exception 'Session exceeds remaining daily budget' using errcode='22023'; end if;
 for target in select value from jsonb_array_elements(session_targets) loop
  if jsonb_typeof(target) is distinct from 'object' or target-array['applicationId','goalId','taskId','expectedVersion']<>'{}'::jsonb
   or (target ? 'applicationId')=(target ? 'goalId')
   or coalesce(target->>'applicationId',target->>'goalId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(target->'expectedVersion') is distinct from 'number' or coalesce(target->>'expectedVersion','') !~ '^[0-9]+$'
   or jsonb_typeof(target->'taskId') is distinct from 'string' or length(target->>'taskId') not between 1 and 200
  then raise exception 'Invalid session target' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(session_targets))<>(select count(distinct (coalesce(value->>'applicationId',value->>'goalId'),value->>'taskId')) from jsonb_array_elements(session_targets)) then raise exception 'Duplicate session targets' using errcode='22023'; end if;
 -- Lock all plans in the same order, then validate every version before any write.
 perform 1 from public.preparation_plans where user_id=owner_id and application_id in(select (value->>'applicationId')::uuid from jsonb_array_elements(session_targets)) order by application_id for update;
 perform 1 from public.learning_goals where user_id=owner_id and id in(select (value->>'goalId')::uuid from jsonb_array_elements(session_targets)) order by id for update;
 for target in select value from jsonb_array_elements(session_targets) loop
  if target ? 'goalId' then
   select * into g from public.learning_goals where user_id=owner_id and id=(target->>'goalId')::uuid;
   if not found then raise exception 'Owned goal not found' using errcode='P0002';end if;
   if g.version<>(target->>'expectedVersion')::integer or g.goal->>'active'<>'true' then raise exception 'Goal changed; reload' using errcode='40001';end if;
   select value into task from jsonb_array_elements(g.goal->'tasks') where value->>'id'=target->>'taskId';
   if task is null or task->>'completed'='true' then raise exception 'Task changed; reload' using errcode='40001';end if;
  else
  select * into p from public.preparation_plans where user_id=owner_id and application_id=(target->>'applicationId')::uuid;
  if not found then raise exception 'Owned plan not found' using errcode='P0002'; end if;
  if p.version<>(target->>'expectedVersion')::integer then raise exception 'Preparation changed; reload' using errcode='40001'; end if;
  select value into task from jsonb_array_elements(p.plan->'tasks') where value->>'id'=target->>'taskId';
  if task is null or task->>'completed'='true' or jsonb_typeof(task->'minutes') is distinct from 'number' then raise exception 'Task changed; reload' using errcode='40001'; end if;
  end if;
 end loop;
 insert into public.preparation_sessions(id,user_id,minutes,targets) values(session_id,owner_id,session_minutes,session_targets);
 for p in select * from public.preparation_plans where user_id=owner_id and application_id in(select (value->>'applicationId')::uuid from jsonb_array_elements(session_targets)) order by application_id loop
  select jsonb_agg(case when exists(select 1 from jsonb_array_elements(session_targets) t where t->>'applicationId'=p.application_id::text and t->>'taskId'=item->>'id')
    and (select coalesce(sum(s.minutes),0) from public.preparation_sessions s where s.user_id=owner_id and exists(select 1 from jsonb_array_elements(s.targets) t where t->>'applicationId'=p.application_id::text and t->>'taskId'=item->>'id')) >= (item->>'minutes')::numeric
   then item||jsonb_build_object('completed',true,'completedAt',now()) else item end order by ordinal)
   into next_tasks from jsonb_array_elements(p.plan->'tasks') with ordinality as tasks(item,ordinal);
  update public.preparation_plans set plan=jsonb_set(plan,'{tasks}',next_tasks),version=version+1,updated_at=now() where application_id=p.application_id;
 end loop;
 for g in select * from public.learning_goals where user_id=owner_id and id in(select (value->>'goalId')::uuid from jsonb_array_elements(session_targets)) order by id loop
  select jsonb_agg(case when exists(select 1 from jsonb_array_elements(session_targets) t where t->>'goalId'=g.id::text and t->>'taskId'=item->>'id')
    and (select coalesce(sum(s.minutes),0) from public.preparation_sessions s where s.user_id=owner_id and exists(select 1 from jsonb_array_elements(s.targets) t where t->>'goalId'=g.id::text and t->>'taskId'=item->>'id')) >= (item->>'minutes')::numeric
   then item||jsonb_build_object('completed',true,'completedAt',now()) else item end order by ordinal)
   into next_tasks from jsonb_array_elements(g.goal->'tasks') with ordinality as tasks(item,ordinal);
  update public.learning_goals set goal=jsonb_set(goal,'{tasks}',next_tasks),version=version+1,updated_at=now() where id=g.id;
 end loop;
 return private.preparation_planner_read_owned(owner_id);
end $$;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to artifact_previous;
revoke all on function private.artifact_previous(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 if operation not like 'artifacts.%' and operation not like 'learning.%' then return private.artifact_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'workspace:read'=any(c.scopes) or (operation in ('artifacts.save','artifacts.archive','learning.save') and not 'drafts:write'=any(c.scopes)) then raise exception 'Artifact scope required' using errcode='42501';end if;
 return private.artifact_owned(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
