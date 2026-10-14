begin;
create table public.preparation_plans (
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid primary key,
 plan jsonb not null check(jsonb_typeof(plan)='object' and octet_length(plan::text)<=100000),
 version integer not null default 1 check(version>0), updated_at timestamptz not null default now(),
 foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade
);
create table public.selection_decisions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 job_id text not null references public.jobs(id), event_key text not null,
 reason text not null check(length(reason) between 1 and 1000), preference text not null,
 evidence text not null check(length(evidence) between 1 and 2000),
 certainty text not null check(certainty in ('exclusion','uncertain')),
 personal_version bigint not null, created_at timestamptz not null default now(), reconsidered_at timestamptz,
 unique(user_id,event_key)
);
create table public.notification_deliveries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null, kind text not null check(kind in ('digest','immediate')),
 event_ids jsonb not null check(jsonb_typeof(event_ids)='array'), delivered_at timestamptz not null default now(),
 unique(user_id,event_key)
);
alter table public.preparation_plans enable row level security;
alter table public.selection_decisions enable row level security;
alter table public.notification_deliveries enable row level security;
revoke all on public.preparation_plans,public.selection_decisions,public.notification_deliveries from public,anon,authenticated;
grant select,insert,update on public.preparation_plans to authenticated;
grant select on public.selection_decisions,public.notification_deliveries to authenticated;
grant update(reconsidered_at) on public.selection_decisions to authenticated;
grant all on public.preparation_plans,public.selection_decisions,public.notification_deliveries to service_role;
create policy preparation_owner_read on public.preparation_plans for select to authenticated using((select auth.uid())=user_id);
create policy preparation_owner_insert on public.preparation_plans for insert to authenticated with check((select auth.uid())=user_id);
create policy preparation_owner_update on public.preparation_plans for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy selection_owner_read on public.selection_decisions for select to authenticated using((select auth.uid())=user_id);
create policy selection_owner_reconsider on public.selection_decisions for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy delivery_owner_read on public.notification_deliveries for select to authenticated using((select auth.uid())=user_id);
create index preparation_owner on public.preparation_plans(user_id);
create index selection_owner_job on public.selection_decisions(user_id,job_id);
create index delivery_owner on public.notification_deliveries(user_id,delivered_at);

-- Optimistic versioning protects completed tasks against a concurrent agent replan.
create function public.save_preparation_plan(app_id uuid, expected_version integer, next_plan jsonb)
returns public.preparation_plans language plpgsql security invoker set search_path='' as $$
declare p public.preparation_plans;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform 1 from public.applications where id=app_id and user_id=auth.uid() for update;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 select * into p from public.preparation_plans where application_id=app_id and user_id=auth.uid() for update;
 if coalesce(p.version,0) is distinct from expected_version then raise exception 'Plan changed; reload' using errcode='40001'; end if;
 if p.application_id is null then
  insert into public.preparation_plans(user_id,application_id,plan) values(auth.uid(),app_id,next_plan) returning * into p;
 else
  update public.preparation_plans set plan=next_plan,version=version+1,updated_at=now() where application_id=app_id returning * into p;
 end if;
 return p;
end $$;
revoke all on function public.save_preparation_plan(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_preparation_plan(uuid,integer,jsonb) to authenticated;

-- Delegate unchanged operations to the previous dispatcher, including installed extensions.
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to muse_dispatch_previous;
revoke all on function private.muse_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.muse_dispatch_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; a public.applications; p public.preparation_plans; d public.selection_decisions; result jsonb; required_scope text;
begin
 if operation not in ('workspace.read','preparation.read','preparation.save','selection.record','selection.read','notifications.read','notifications.ack','applications.record') then
  return private.muse_dispatch_previous(credential_hash,operation,payload);
 end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 required_scope:=case when operation='preparation.save' then 'drafts:write' when operation in ('selection.record','notifications.ack') then 'activity:write' else 'workspace:read' end;
 if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation='workspace.read' then
  result:=private.muse_dispatch_previous(credential_hash,operation,payload);
  return result||jsonb_build_object('preparationPlans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.preparation_plans x where user_id=c.user_id));
 elsif operation in ('preparation.read','preparation.save','applications.record') then
  select * into a from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id for update;
  if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
  select * into p from public.preparation_plans where application_id=a.id and user_id=c.user_id for update;
  if operation='preparation.read' then
   return jsonb_build_object('application',to_jsonb(a),'timeZone',(select search->'quietMode'->>'timezone' from public.preferences where user_id=c.user_id),'job',(select to_jsonb(j) from public.jobs j where j.id=a.job_id),'resume',(select to_jsonb(r) from public.resumes r where r.user_id=c.user_id and r.id::text=a.draft->>'resumeId'),'preparation',case when p.application_id is null then null else to_jsonb(p) end);
  elsif operation='applications.record' then
   return jsonb_build_object('application',to_jsonb(a),'attempts',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'application_id',t.application_id,'state',t.state,'revision',t.revision,'created_at',t.created_at,'started_at',t.started_at,'finished_at',t.finished_at,'receipt',t.receipt,'context_snapshot',jsonb_build_object('application',jsonb_build_object('draft',t.context_snapshot->'application'->'draft'),'job',t.context_snapshot->'job','resume',t.context_snapshot->'resume')) order by t.created_at),'[]') from public.submission_attempts t where t.user_id=c.user_id and t.application_id=a.id));
  end if;
  if coalesce(p.version,0) is distinct from (payload->>'expectedVersion')::integer then raise exception 'Plan changed' using errcode='40001'; end if;
  if jsonb_typeof(payload->'plan') is distinct from 'object' then raise exception 'Plan required' using errcode='22023'; end if;
  if p.application_id is null then
   insert into public.preparation_plans(user_id,application_id,plan) values(c.user_id,a.id,payload->'plan') returning * into p;
  else
   update public.preparation_plans set plan=payload->'plan',version=version+1,updated_at=now() where application_id=a.id returning * into p;
  end if;
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload) values(c.user_id,a.id,'preparation:'||a.id||':'||p.version,'preparation_updated','agent',jsonb_build_object('text','Preparation plan updated','deadlineAt',p.plan->'deadline'->>'date','actionRequired',false));
  return to_jsonb(p);
 elsif operation='selection.read' then
  return (select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('jobs',to_jsonb(j)) order by x.created_at desc),'[]') from public.selection_decisions x join public.jobs j on j.id=x.job_id where x.user_id=c.user_id);
 elsif operation='selection.record' then
  if not exists(select 1 from public.jobs where id=payload->>'jobId') then raise exception 'Job not found' using errcode='P0002'; end if;
  if length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 then raise exception 'Event key required' using errcode='22023'; end if;
  insert into public.selection_decisions(user_id,job_id,event_key,reason,preference,evidence,certainty,personal_version)
   values(c.user_id,payload->>'jobId',payload->>'eventKey',payload->>'reason',payload->>'preference',payload->>'evidence',payload->>'certainty',coalesce((select version from private.agent_settings_versions where user_id=c.user_id),1))
   on conflict(user_id,event_key) do nothing returning * into d;
  if d.id is null then
   select * into d from public.selection_decisions where user_id=c.user_id and event_key=payload->>'eventKey';
   if d.job_id is distinct from payload->>'jobId' then raise exception 'Event key reused' using errcode='22023'; end if;
  end if;
  return to_jsonb(d);
 elsif operation='notifications.read' then
  return jsonb_build_object('settings',(select search->'quietMode' from public.preferences where user_id=c.user_id),
   'lastDigestAt',(select max(delivered_at) from public.notification_deliveries where user_id=c.user_id and kind='digest'),
   'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at),'[]') from public.activity_events e where e.user_id=c.user_id and not exists(select 1 from public.notification_deliveries n where n.user_id=c.user_id and n.event_ids ? e.id::text)),
   'plans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.preparation_plans x where user_id=c.user_id),
   'applications',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'blocker',x.blocker,'revision',x.revision)),'[]') from public.applications x where user_id=c.user_id),
   'deliveries',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from public.notification_deliveries n where user_id=c.user_id));
 elsif operation='notifications.ack' then
  if length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 or coalesce(payload->>'kind','') not in ('digest','immediate') or jsonb_typeof(payload->'eventIds') is distinct from 'array' or jsonb_array_length(payload->'eventIds')>500 then raise exception 'Invalid delivery' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'eventIds') x where not exists(select 1 from public.activity_events e where e.id::text=x and e.user_id=c.user_id) and not exists(select 1 from public.preparation_plans plan_row where plan_row.user_id=c.user_id and x='deadline:'||plan_row.application_id||':'||plan_row.version) and not exists(select 1 from public.applications decision_app where decision_app.user_id=c.user_id and x='decision:'||decision_app.id||':'||decision_app.revision)) then raise exception 'Owned events required' using errcode='42501'; end if;
  insert into public.notification_deliveries(user_id,event_key,kind,event_ids) values(c.user_id,payload->>'eventKey',payload->>'kind',payload->'eventIds') on conflict(user_id,event_key) do nothing;
  return (select to_jsonb(n) from public.notification_deliveries n where n.user_id=c.user_id and n.event_key=payload->>'eventKey');
 end if;
 raise exception 'Unknown operation' using errcode='22023';
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
