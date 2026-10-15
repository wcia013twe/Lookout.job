begin;
create table public.preparation_planner_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 daily_minutes integer not null default 45 check(daily_minutes between 0 and 240),
 version integer not null default 0 check(version>=0)
);
create table public.preparation_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 minutes integer not null check(minutes between 1 and 240),
 targets jsonb not null check(jsonb_typeof(targets)='array'),
 completed_at timestamptz not null default now()
);
create index preparation_sessions_owner_date on public.preparation_sessions(user_id,completed_at);
alter table public.preparation_planner_settings enable row level security;
alter table public.preparation_sessions enable row level security;
revoke all on public.preparation_planner_settings,public.preparation_sessions from public,anon,authenticated;
grant select on public.preparation_planner_settings,public.preparation_sessions to authenticated;
grant all on public.preparation_planner_settings,public.preparation_sessions to service_role;
create policy prep_budget_owner_read on public.preparation_planner_settings for select to authenticated using((select auth.uid())=user_id);
create policy prep_session_owner_read on public.preparation_sessions for select to authenticated using((select auth.uid())=user_id);

create function private.preparation_planner_read_owned(owner_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
  'applications',(select coalesce(jsonb_object_agg(a.job_id,(j.employer||a.draft)||jsonb_build_object('id',a.job_id,'backendId',a.id,'status',a.status,'milestones',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.application_milestones m where m.application_id=a.id and m.user_id=owner_id),'company',coalesce(j.employer->>'company',a.draft->>'company'),'title',coalesce(j.employer->>'title',a.draft->>'title'))),'{}') from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id),
  'settings',coalesce((select jsonb_build_object('dailyMinutes',daily_minutes,'version',version) from public.preparation_planner_settings where user_id=owner_id),'{"dailyMinutes":45,"version":0}'::jsonb),
  'sessions',(select coalesce(jsonb_agg(to_jsonb(s) order by completed_at,id),'[]') from public.preparation_sessions s where user_id=owner_id),
  'plans',(select coalesce(jsonb_agg(to_jsonb(p) order by application_id),'[]') from public.preparation_plans p where user_id=owner_id),
  'timeZone',coalesce((select search->'quietMode'->>'timezone' from public.preferences where user_id=owner_id),'UTC'))
$$;
create function private.preparation_budget_owned(owner_id uuid, next_minutes integer, expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_version integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if next_minutes is null or next_minutes not between 0 and 240 or expected_version is null or expected_version<0 then raise exception 'Invalid preparation budget' using errcode='22023'; end if;
 insert into public.preparation_planner_settings(user_id) values(owner_id) on conflict(user_id) do nothing;
 select version into current_version from public.preparation_planner_settings where user_id=owner_id for update;
 if current_version<>expected_version then raise exception 'Budget changed; reload' using errcode='40001'; end if;
 update public.preparation_planner_settings set daily_minutes=next_minutes,version=version+1 where user_id=owner_id;
 return private.preparation_planner_read_owned(owner_id);
end $$;
create function private.preparation_session_owned(owner_id uuid, session_id uuid, session_minutes integer, session_targets jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.preparation_sessions; settings public.preparation_planner_settings;
 target jsonb; p public.preparation_plans; task jsonb; zone text; spent integer; next_tasks jsonb;
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
  if jsonb_typeof(target) is distinct from 'object' or target-'applicationId'-'taskId'-'expectedVersion'<>'{}'::jsonb
   or coalesce(target->>'applicationId','') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
   or jsonb_typeof(target->'expectedVersion') is distinct from 'number' or coalesce(target->>'expectedVersion','') !~ '^[0-9]+$'
   or jsonb_typeof(target->'taskId') is distinct from 'string' or length(target->>'taskId') not between 1 and 200
  then raise exception 'Invalid session target' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(session_targets))<>(select count(distinct (value->>'applicationId',value->>'taskId')) from jsonb_array_elements(session_targets)) then raise exception 'Duplicate session targets' using errcode='22023'; end if;
 -- Lock all plans in the same order, then validate every version before any write.
 perform 1 from public.preparation_plans where user_id=owner_id and application_id in(select (value->>'applicationId')::uuid from jsonb_array_elements(session_targets)) order by application_id for update;
 for target in select value from jsonb_array_elements(session_targets) loop
  select * into p from public.preparation_plans where user_id=owner_id and application_id=(target->>'applicationId')::uuid;
  if not found then raise exception 'Owned plan not found' using errcode='P0002'; end if;
  if p.version<>(target->>'expectedVersion')::integer then raise exception 'Preparation changed; reload' using errcode='40001'; end if;
  select value into task from jsonb_array_elements(p.plan->'tasks') where value->>'id'=target->>'taskId';
  if task is null or task->>'completed'='true' or jsonb_typeof(task->'minutes') is distinct from 'number' then raise exception 'Task changed; reload' using errcode='40001'; end if;
 end loop;
 insert into public.preparation_sessions(id,user_id,minutes,targets) values(session_id,owner_id,session_minutes,session_targets);
 for p in select * from public.preparation_plans where user_id=owner_id and application_id in(select (value->>'applicationId')::uuid from jsonb_array_elements(session_targets)) order by application_id loop
  select jsonb_agg(case when exists(select 1 from jsonb_array_elements(session_targets) t where t->>'applicationId'=p.application_id::text and t->>'taskId'=item->>'id')
    and (select coalesce(sum(s.minutes),0) from public.preparation_sessions s where s.user_id=owner_id and exists(select 1 from jsonb_array_elements(s.targets) t where t->>'applicationId'=p.application_id::text and t->>'taskId'=item->>'id')) >= (item->>'minutes')::numeric
   then item||jsonb_build_object('completed',true,'completedAt',now()) else item end order by ordinal)
   into next_tasks from jsonb_array_elements(p.plan->'tasks') with ordinality as tasks(item,ordinal);
  update public.preparation_plans set plan=jsonb_set(plan,'{tasks}',next_tasks),version=version+1,updated_at=now() where application_id=p.application_id;
 end loop;
 return private.preparation_planner_read_owned(owner_id);
end $$;
revoke all on function private.preparation_planner_read_owned(uuid),private.preparation_budget_owned(uuid,integer,integer),private.preparation_session_owned(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.preparation_planner_read_owned(uuid),private.preparation_budget_owned(uuid,integer,integer),private.preparation_session_owned(uuid,uuid,integer,jsonb) to service_role;

create function private.preparation_planner_authenticated(action text,next_minutes integer default null,expected_version integer default null,session_id uuid default null,session_targets jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if action='read' then return private.preparation_planner_read_owned(auth.uid());
 elsif action='budget' then return private.preparation_budget_owned(auth.uid(),next_minutes,expected_version);
 elsif action='complete' then return private.preparation_session_owned(auth.uid(),session_id,next_minutes,session_targets);
 else raise exception 'Unknown planner action' using errcode='22023'; end if;
end $$;
revoke all on function private.preparation_planner_authenticated(text,integer,integer,uuid,jsonb) from public,anon;
grant execute on function private.preparation_planner_authenticated(text,integer,integer,uuid,jsonb) to authenticated;
create function public.read_preparation_planner() returns jsonb language sql security invoker set search_path='' as $$ select private.preparation_planner_authenticated('read') $$;
create function public.save_preparation_budget(next_minutes integer,expected_version integer) returns jsonb language sql security invoker set search_path='' as $$ select private.preparation_planner_authenticated('budget',next_minutes,expected_version) $$;
create function public.complete_preparation_session(session_id uuid,session_minutes integer,session_targets jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.preparation_planner_authenticated('complete',session_minutes,null,session_id,session_targets) $$;
revoke all on function public.read_preparation_planner(),public.save_preparation_budget(integer,integer),public.complete_preparation_session(uuid,integer,jsonb) from public,anon;
grant execute on function public.read_preparation_planner(),public.save_preparation_budget(integer,integer),public.complete_preparation_session(uuid,integer,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to preparation_planner_previous;
revoke all on function private.preparation_planner_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.preparation_planner_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
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
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
