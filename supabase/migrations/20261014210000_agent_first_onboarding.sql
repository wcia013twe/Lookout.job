begin;
create table private.onboarding_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 step text not null default 'connection_pending',
 data jsonb not null default '{}',
 completed_steps text[] not null default '{}',
 updated_at timestamptz not null default now()
);
create table private.onboarding_events (
 user_id uuid not null references auth.users(id) on delete cascade, event_key text not null,
 request jsonb not null, response jsonb not null, created_at timestamptz not null default now(), primary key(user_id,event_key)
);
create table private.agent_tasks (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('discover','prepare_application','validate_auto_apply','configure_delivery')),
 target jsonb not null default '{}', state text not null default 'queued' check(state in ('queued','claimed','running','completed','needs_user','failed','uncertain')),
 revision bigint not null default 0, onboarding_revision bigint not null, event_key text not null, claim_token uuid, claimed_by uuid, lease_until timestamptz,
 attempts integer not null default 0, result jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,event_key)
);
create index agent_tasks_pending on private.agent_tasks(user_id,state,created_at);
alter table private.onboarding_sessions enable row level security;
alter table private.onboarding_events enable row level security;
alter table private.agent_tasks enable row level security;
revoke all on private.onboarding_sessions,private.onboarding_events,private.agent_tasks from public,anon,authenticated;

create function private.onboarding_view(owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.onboarding_sessions; prompt text; j public.jobs;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 insert into private.onboarding_sessions(user_id) values(owner_id) on conflict do nothing;
 update private.agent_tasks set state=case when kind='discover' and attempts<3 then 'queued' else 'uncertain' end,claim_token=null,lease_until=null,revision=revision+1,result=jsonb_build_object('summary',case when kind='discover' and attempts<3 then 'Discovery claim expired; safely queued for a bounded retry.' else 'Agent lease expired. Outcome is uncertain; review before another external action.' end),updated_at=now() where user_id=owner_id and state in ('claimed','running') and lease_until<now();
 select * into s from private.onboarding_sessions where user_id=owner_id;
 prompt:=case s.step when 'connection_pending' then 'Connect an agent, then ask it to read onboarding state. Runtime capabilities must be verified.' when 'intent_pending' then 'What kind of jobs are you looking for?' when 'first_match_pending' then 'Find one relevant live employer posting and publish it with verification evidence. Resume is optional.' when 'action_policy_pending' then 'Want me to recommend jobs like this, prepare applications for review, or help set up auto-apply for routine matches?' when 'profile_verification_pending' then 'Import a resume if needed and ask the person to verify essential profile facts. Do not verify them for the person.' when 'execution_ready' then 'Queue permitted discovery or preparation and report its actual result. Auto-apply setup does not authorize a submission.' when 'delivery_pending' then 'Choose daily roundup, important matches, or quiet mode. Scheduling remains inactive until a runtime confirms channel and schedule.' when 'ready' then 'Your first result is available. The website and social setup are optional.' when 'paused' then 'Onboarding is paused. Resume when ready.' else 'Read blockers and retry the current step when resolved.' end;
 if s.data ? 'match' then select * into j from public.jobs where id=s.data->'match'->>'jobId'; end if;
 return to_jsonb(s)||jsonb_build_object('prompt',prompt,'capabilities',jsonb_build_object('poll',true,'push',false,'managedRuntime',false,'scheduler',false,'autoApplyEnabled',false),'matchJob',case when j.id is null then null else jsonb_build_object('id',j.id,'url',j.canonical_url,'employer',j.employer) end,'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'claim_token'-'claimed_by') from (select * from private.agent_tasks where user_id=owner_id order by created_at desc limit 20)t),'[]'::jsonb));
end $$;

create function private.onboarding_action(owner_id uuid, operation text, payload jsonb, connection_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare s private.onboarding_sessions; old private.onboarding_events; response jsonb; d jsonb; event text; next_step text; t private.agent_tasks; j public.jobs; c private.agent_connections;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>20000 or payload ?| array['user_id','owner_id','userId'] then raise exception 'Invalid payload' using errcode='22023'; end if;
 if operation='onboarding.get_state' then return private.onboarding_view(owner_id); end if;
 if operation='tasks.read' then perform private.onboarding_view(owner_id); return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(x)-'claim_token'-'claimed_by') from (select * from private.agent_tasks where user_id=owner_id order by created_at desc limit 50)x),'[]'::jsonb),'dispatch','poll','pushAvailable',false); end if;
 perform private.onboarding_view(owner_id);
 select * into s from private.onboarding_sessions where user_id=owner_id for update;
 if operation='onboarding.submit_step' then
  if length(coalesce(payload->>'eventKey','')) not between 1 and 100 then raise exception 'Event key required' using errcode='22023'; end if;
  select * into old from private.onboarding_events where user_id=owner_id and event_key=payload->>'eventKey';
  if found then
   if old.request is distinct from payload then raise exception 'Idempotency key reused with different data' using errcode='22023'; end if;
   return old.response;
  end if;
  if (select count(*) from private.onboarding_events where user_id=owner_id and created_at>now()-interval '1 hour')>=100 then raise exception 'Onboarding rate limit; retry later' using errcode='22023'; end if;
  if (payload->>'expectedRevision')::bigint is distinct from s.revision then raise exception 'Onboarding changed' using errcode='40001'; end if;
  event:=payload->>'event'; d:=coalesce(payload->'data','{}'); next_step:=s.step;
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Step data required' using errcode='22023'; end if;
  if event='pause' and s.step<>'ready' then s.data:=s.data||jsonb_build_object('resumeStep',s.step); next_step:='paused';
  elsif event='resume' and s.step='paused' then next_step:=s.data->>'resumeStep';
  elsif event='runtime' and s.step='connection_pending' then
   if connection_id is null then raise exception 'Verified agent credential required' using errcode='42501'; end if;
   select * into c from private.agent_connections where id=connection_id and user_id=owner_id;
   if c.id is null or not ('batches:write'=any(c.scopes)) or not ('preferences:write'=any(c.scopes)) then raise exception 'Discovery and preference capabilities required' using errcode='42501'; end if;
   if d->'browsing' is distinct from 'true'::jsonb then raise exception 'Runtime must confirm browsing capability' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('runtime',jsonb_build_object('connectionId',c.id,'name',c.name,'scopes',c.scopes,'browsingReportedAt',now(),'dispatch','poll')); next_step:='intent_pending';
  elsif event='intent' and s.step in ('intent_pending','first_match_pending') then
   if length(trim(coalesce(d->>'text',''))) not between 3 and 2000 or jsonb_typeof(coalesce(d->'constraints','{}'))<>'object' then raise exception 'Search intent required' using errcode='22023'; end if;
   if exists(select 1 from jsonb_object_keys(coalesce(d->'constraints','{}')) k where k not in ('roles','level','employmentTypes','locations','remote','minimumCompensation','companies','teams')) then raise exception 'Unknown search constraint' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('intent',jsonb_build_object('text',d->>'text','constraints',coalesce(d->'constraints','{}'))); next_step:='first_match_pending';
  elsif event='first_match' and s.step='first_match_pending' then
   if connection_id is null then raise exception 'Agent evidence required' using errcode='42501'; end if;
   select jobs.* into j from public.jobs join public.batch_items bi on bi.job_id=jobs.id where jobs.id=d->>'jobId' and bi.user_id=owner_id limit 1;
   if j.id is null or j.canonical_url !~ '^https://' or d->>'sourceUrl' is distinct from j.canonical_url or d->'available' is distinct from 'true'::jsonb or (d->>'checkedAt')::timestamptz < now()-interval '24 hours' or (d->>'checkedAt')::timestamptz > now()+interval '1 minute' or d->>'checkedAt' is null or length(trim(coalesce(d->>'evidence',''))) not between 10 and 2000 or length(trim(coalesce(d->>'fit',''))) not between 5 and 2000 then raise exception 'Fresh owned employer evidence required' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('match',d||jsonb_build_object('verifiedBy',connection_id,'fitPreliminary',not exists(select 1 from public.profiles where user_id=owner_id and verified_at is not null and exists(select 1 from public.resumes where user_id=owner_id)))); next_step:='action_policy_pending';
  elsif event='resolve_task' then
   if connection_id is not null then raise exception 'Human review required' using errcode='42501'; end if;
   select * into t from private.agent_tasks where id=(d->>'taskId')::uuid and user_id=owner_id for update;
   if t.id is null or t.state<>'uncertain' or t.revision is distinct from (d->>'expectedTaskRevision')::bigint then raise exception 'Current uncertain task required' using errcode='40001'; end if;
   update private.agent_tasks set state='failed',claim_token=null,lease_until=null,revision=revision+1,result=jsonb_build_object('summary','Human reviewed the runtime and reported that this task did not complete. Safe to request a bounded retry; existing submission guards still apply.'),updated_at=now() where id=t.id;
  elsif event='no_match' and s.step='first_match_pending' then
   if length(trim(coalesce(d->>'reason',''))) not between 5 and 1000 then raise exception 'Explain the blocker' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('blocker',d->>'reason');
  elsif event='policy' and s.step in ('action_policy_pending','profile_verification_pending','execution_ready') then
   if exists(select 1 from private.agent_tasks where user_id=owner_id and state in ('queued','claimed','running','uncertain')) then raise exception 'Resolve active or uncertain work before changing policy' using errcode='40001'; end if;
   if coalesce(d->>'choice','') not in ('recommend','prepare','auto_apply_requested') then raise exception 'Policy choice required' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('policy',d->>'choice','policySetAt',now(),'autoApplyEnabled',false);
   insert into public.preferences(user_id,search) values(owner_id,jsonb_build_object('onboarding',jsonb_build_object('intent',s.data->'intent','policy',d->>'choice'))) on conflict(user_id) do update set search=preferences.search||excluded.search,updated_at=now();
   next_step:=case when d->>'choice'='recommend' then 'execution_ready' else 'profile_verification_pending' end;
  elsif event='profile_checked' and s.step='profile_verification_pending' then
   if not exists(select 1 from public.profiles where user_id=owner_id and verified_at is not null) or not exists(select 1 from public.resumes where user_id=owner_id and object_path is not null and content_hash is not null) then raise exception 'Human-verified profile and uploaded resume required' using errcode='22023'; end if;
   next_step:='execution_ready';
  elsif event='execution_result' and s.step='execution_ready' then
   select * into t from private.agent_tasks where id=(d->>'taskId')::uuid and user_id=owner_id and state='completed';
   if t.id is null or t.kind is distinct from (case s.data->>'policy' when 'recommend' then 'discover' when 'prepare' then 'prepare_application' else 'validate_auto_apply' end) then raise exception 'Completed owned task required' using errcode='22023'; end if;
   s.data:=s.data||jsonb_build_object('result',jsonb_build_object('taskId',t.id,'kind',t.kind,'result',t.result)); next_step:='delivery_pending';
  elsif event='delivery' and s.step='delivery_pending' then
   if coalesce(d->>'mode','') not in ('daily','important','quiet','skip') then raise exception 'Delivery choice required' using errcode='22023'; end if;
   if d->>'mode'<>'skip' and (length(trim(coalesce(d->>'channel',''))) not between 1 and 100 or not exists(select 1 from pg_timezone_names where name=d->>'timezone') or (d->>'mode'='daily' and coalesce(d->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')) then raise exception 'Channel timezone and delivery time required' using errcode='22023'; end if;
   insert into public.preferences(user_id,search) values(owner_id,jsonb_build_object('deliveryRequest',d||jsonb_build_object('active',false))) on conflict(user_id) do update set search=preferences.search||excluded.search,updated_at=now();
   s.data:=s.data||jsonb_build_object('delivery',d||jsonb_build_object('active',false),'social',jsonb_build_object('visibility','private','sharingEnabled',false)); next_step:='ready';
  else raise exception 'Step not allowed' using errcode='22023'; end if;
  update private.onboarding_sessions set revision=revision+1,step=next_step,data=s.data,completed_steps=case when next_step<>s.step then array_append(s.completed_steps,s.step) else s.completed_steps end,updated_at=now() where user_id=owner_id;
  response:=private.onboarding_view(owner_id);
  insert into private.onboarding_events(user_id,event_key,request,response) values(owner_id,payload->>'eventKey',payload,response);
  return response;
 elsif operation='tasks.create' then
  if length(coalesce(payload->>'eventKey','')) not between 1 and 100 or coalesce(payload->>'kind','') not in ('discover','prepare_application','validate_auto_apply','configure_delivery') then raise exception 'Task kind and key required' using errcode='22023'; end if;
  select * into t from private.agent_tasks where user_id=owner_id and event_key=payload->>'eventKey';
  if found then
   if t.onboarding_revision is distinct from (payload->>'expectedRevision')::bigint or t.kind is distinct from payload->>'kind' or t.target is distinct from coalesce(payload->'target','{}') then raise exception 'Task key reused' using errcode='22023'; end if;
   return to_jsonb(t)-'claim_token'-'claimed_by';
  end if;
  if (payload->>'expectedRevision')::bigint is distinct from s.revision then raise exception 'Onboarding changed' using errcode='40001'; end if;
  if exists(select 1 from private.agent_tasks where user_id=owner_id and kind=payload->>'kind' and state in ('queued','claimed','running','uncertain')) then raise exception 'Resolve pending or uncertain work before retrying' using errcode='40001'; end if;
  if (select count(*) from private.agent_tasks where user_id=owner_id and kind=payload->>'kind' and created_at>now()-interval '1 hour')>=3 then raise exception 'Three attempts per task kind/hour; resolve the blocker before retrying' using errcode='22023'; end if;
  if (select count(*) from private.agent_tasks where user_id=owner_id and created_at>now()-interval '1 hour')>=20 then raise exception 'Task rate limit; retry later' using errcode='22023'; end if;
  if payload->>'kind'='discover' and s.step not in ('first_match_pending','execution_ready') or payload->>'kind'='prepare_application' and (s.step<>'execution_ready' or s.data->>'policy'<>'prepare') or payload->>'kind'='validate_auto_apply' and (s.step<>'execution_ready' or s.data->>'policy'<>'auto_apply_requested') or payload->>'kind'='configure_delivery' and s.step not in ('delivery_pending','ready') then raise exception 'Task not allowed at this step' using errcode='22023'; end if;
  if payload->>'kind'='discover' and not s.data ? 'intent' then raise exception 'Search intent required' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(payload->'target','{}'))<>'object' or exists(select 1 from jsonb_object_keys(coalesce(payload->'target','{}')) k where k not in ('jobId','applicationId')) then raise exception 'Bounded target required' using errcode='22023'; end if;
  if payload->'target' ? 'jobId' and not exists(select 1 from public.batch_items where user_id=owner_id and job_id=payload->'target'->>'jobId') then raise exception 'Owned target required' using errcode='42501'; end if;
  if payload->'target' ? 'applicationId' and not exists(select 1 from public.applications where user_id=owner_id and id=(payload->'target'->>'applicationId')::uuid) then raise exception 'Owned target required' using errcode='42501'; end if;
  insert into private.agent_tasks(user_id,kind,target,onboarding_revision,event_key) values(owner_id,payload->>'kind',coalesce(payload->'target','{}'),s.revision,payload->>'eventKey') returning * into t;
  return to_jsonb(t)-'claim_token'-'claimed_by';
 elsif operation in ('tasks.claim','tasks.report_result') then
  if connection_id is null then raise exception 'Agent credential required' using errcode='42501'; end if;
  select * into t from private.agent_tasks where id=(payload->>'taskId')::uuid and user_id=owner_id for update;
  if t.id is null then raise exception 'Owned task not found' using errcode='P0002'; end if;
  if operation='tasks.claim' then
   if t.state in ('claimed','running') and t.claimed_by=connection_id and t.lease_until>now() then return to_jsonb(t); end if;
   -- Only discovery is safe to reclaim. Preparation/delivery may have external effects.
   if t.state not in ('queued','claimed') or t.state='claimed' and (t.lease_until>now() or t.kind<>'discover') or t.attempts>=3 then raise exception 'Task is not claimable' using errcode='40001'; end if;
   update private.agent_tasks set state='claimed',claimed_by=connection_id,claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1,revision=revision+1,updated_at=now() where id=t.id returning * into t;
  else
   if t.claimed_by=connection_id and t.claim_token=(payload->>'claimToken')::uuid and t.state=payload->>'state' and t.result=payload->'result' then return to_jsonb(t); end if;
   if t.claimed_by is distinct from connection_id or t.claim_token is distinct from (payload->>'claimToken')::uuid or t.lease_until<now() or (payload->>'expectedRevision')::bigint is distinct from t.revision or t.state not in ('claimed','running') then raise exception 'Current claim required' using errcode='40001'; end if;
   if coalesce(payload->>'state','') not in ('running','completed','needs_user','failed','uncertain') or jsonb_typeof(payload->'result') is distinct from 'object' or length(trim(coalesce(payload->'result'->>'summary',''))) not between 3 and 2000 then raise exception 'Actual result and summary required' using errcode='22023'; end if;
   if payload->>'state'='completed' then
    if t.kind='discover' and not exists(select 1 from public.batch_items where user_id=owner_id and batch_id=(payload->'result'->>'batchId')::uuid) then raise exception 'Owned batch required' using errcode='22023'; end if;
    if t.kind='prepare_application' and not exists(select 1 from public.applications where user_id=owner_id and id=(payload->'result'->>'applicationId')::uuid and status in ('Awaiting approval','Blocked')) then raise exception 'Actual prepared draft required' using errcode='22023'; end if;
    if t.kind in ('validate_auto_apply','configure_delivery') then raise exception 'Runtime activation is not verified; report needs_user with prerequisites' using errcode='22023'; end if;
   end if;
   update private.agent_tasks set state=payload->>'state',result=payload->'result',revision=revision+1,updated_at=now() where id=t.id returning * into t;
  end if;
  return to_jsonb(t);
 end if;
 raise exception 'Unknown onboarding operation' using errcode='22023';
end $$;
revoke all on function private.onboarding_view(uuid),private.onboarding_action(uuid,text,jsonb,uuid) from public,anon,authenticated;

create function private.onboarding_authenticated(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if operation not in ('onboarding.get_state','onboarding.submit_step','tasks.create','tasks.read') then raise exception 'Human operation not allowed' using errcode='42501'; end if;
 return private.onboarding_action(auth.uid(),operation,payload,null);
end $$;
revoke all on function private.onboarding_authenticated(text,jsonb) from public,anon;
grant execute on function private.onboarding_authenticated(text,jsonb) to authenticated;
create function public.onboarding_action(operation text,payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.onboarding_authenticated(operation,payload)$$;
revoke all on function public.onboarding_action(text,jsonb) from public,anon;
grant execute on function public.onboarding_action(text,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to onboarding_previous_dispatch;
revoke all on function private.onboarding_previous_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
create or replace function private.save_preferences_authenticated(search_next jsonb, lists_next jsonb, active_next text, theme_next jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
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
end $$;

commit;
