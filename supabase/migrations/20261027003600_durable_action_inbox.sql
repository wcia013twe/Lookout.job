-- Durable application handoffs. Only existing domain transitions can resolve them.
create table public.action_inbox (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid not null,
 revision integer not null,
 attempt_id uuid,
 kind text not null check(kind in ('review_application','resolve_blocker','check_submission')),
 source_key text not null,
 reason text not null,
 available_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 resolution text,
 foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade,
 check ((resolved_at is null) = (resolution is null))
);
create unique index action_inbox_one_pending on public.action_inbox(application_id) where resolved_at is null;
create index action_inbox_owner_history on public.action_inbox(user_id,created_at,id);
alter table public.action_inbox enable row level security;
revoke all on public.action_inbox from public,anon,authenticated;
grant select on public.action_inbox to authenticated;
grant all on public.action_inbox to service_role;
create policy action_inbox_owner_read on public.action_inbox for select to authenticated using((select auth.uid())=user_id);

-- One tiny invalidation record per owner, not a stream of private document bodies.
create table public.workspace_changes (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version bigint not null default 1
);
alter table public.workspace_changes enable row level security;
revoke all on public.workspace_changes from public,anon,authenticated;
grant select on public.workspace_changes to authenticated;
grant all on public.workspace_changes to service_role;
create policy workspace_changes_owner_read on public.workspace_changes for select to authenticated using((select auth.uid())=user_id);

create function private.sync_application_inbox(app_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.applications; t public.submission_attempts; k text; why text; due timestamptz:=now(); key text; pending public.action_inbox;
begin
 select * into a from public.applications where id=app_id for update;
 if not found then return;end if;
 select * into t from public.submission_attempts where application_id=a.id and user_id=a.user_id and state in ('started','uncertain') order by created_at desc,id desc limit 1;
 if found then
  -- A signed-in human may report a positive outcome. Keep the attempt uncertain
  -- (never turn it into an observed receipt or allow retry), but close the handoff.
  if a.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') and exists(select 1 from public.action_inbox where application_id=a.id and attempt_id=t.id and resolution='user_reported_submitted') then return;end if;
  k:='check_submission';
  why:='Verify the employer portal or confirmation email before allowing another attempt.';
  due:=case when t.state='started' then t.started_at+interval '5 minutes' else now() end;
  key:=t.id::text||':'||t.state;
 elsif a.status='Awaiting approval' then
  k:='review_application';why:='Your approval is required before this application can proceed.';key:=a.revision::text||':review';
 elsif a.status='Blocked' then
  k:='resolve_blocker';why:=coalesce(nullif(a.blocker,''),'Review the employer form and resolve the application blocker.');key:=a.revision::text||':blocker:'||md5(why);
 end if;
 select * into pending from public.action_inbox where application_id=a.id and resolved_at is null;
 -- Repeated reports are no-ops. Uncertainty takes precedence over status edits.
 if pending.id is not null and k is not null and pending.kind=k and pending.source_key=key then return;end if;
 update public.action_inbox set resolved_at=now(),resolution=case when k is not null then 'superseded' else 'condition_resolved' end
 where application_id=a.id and resolved_at is null;
 if k is not null then
  insert into public.action_inbox(user_id,application_id,revision,attempt_id,kind,source_key,reason,available_at)
  values(a.user_id,a.id,a.revision,case when k='check_submission' then t.id end,k,key,why,due);
 end if;
end $$;
revoke all on function private.sync_application_inbox(uuid) from public,anon,authenticated;

-- Definer is required only for this fixed trigger: browsers cannot write the log.
create function private.application_inbox_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='applications' then perform private.sync_application_inbox(new.id);
 else perform private.sync_application_inbox(new.application_id);end if;
 return new;
end $$;
revoke all on function private.application_inbox_changed() from public,anon,authenticated;
create trigger application_inbox_changed after insert or update on public.applications for each row execute function private.application_inbox_changed();
create trigger application_inbox_changed after insert or update on public.submission_attempts for each row execute function private.application_inbox_changed();

create function private.workspace_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 -- Auth deletion must not recreate a cascading owner row.
 if exists(select 1 from auth.users where id=owner_id) then
  insert into public.workspace_changes(user_id) values(owner_id)
  on conflict(user_id) do update set version=public.workspace_changes.version+1;
 end if;
 return null;
end $$;
revoke all on function private.workspace_changed() from public,anon,authenticated;
do $$ declare tab text;begin
 foreach tab in array array['profiles','preferences','resumes','answer_library','applications','activity_events','submission_attempts','application_milestones','job_batches','batch_items','action_inbox','preparation_plans','preparation_planner_settings','preparation_sessions','learning_goals','career_artifacts'] loop
  execute format('create trigger workspace_changed after insert or update or delete on public.%I for each row execute function private.workspace_changed()',tab);
 end loop;
 -- Local SQL tests do not install Supabase Realtime; production publication is explicit.
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.workspace_changes;
 end if;
end $$;

-- Existing pending work remains visible on upgrade; no invented submission evidence.
do $$ declare app_id uuid;begin
 for app_id in select id from public.applications loop perform private.sync_application_inbox(app_id);end loop;
end $$;

create function private.read_action_inbox(owner_id uuid,payload jsonb) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare state text:=coalesce(payload->>'state','pending');off integer:=coalesce((payload->>'offset')::integer,0);items jsonb;
begin
 if jsonb_typeof(payload) is distinct from 'object' or payload - array['state','offset'] <> '{}'::jsonb or state not in ('pending','resolved','all') or off<0 or off>100000 then
  raise exception 'Expected inbox state and bounded offset' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]') into items from (
  select * from public.action_inbox where user_id=owner_id and (state='all' or (state='pending' and resolved_at is null) or (state='resolved' and resolved_at is not null))
  order by created_at desc,id desc offset off limit 100
 ) x;
 return jsonb_build_object('items',items,'nextOffset',case when jsonb_array_length(items)=100 then off+100 end);
end $$;
revoke all on function private.read_action_inbox(uuid,jsonb) from public,anon,authenticated;

create function public.read_action_inbox(payload jsonb default '{}') returns jsonb
language sql stable security definer set search_path='' as $$
 select private.read_action_inbox(auth.uid(),payload);
$$;
revoke all on function public.read_action_inbox(jsonb) from public,anon;
grant execute on function public.read_action_inbox(jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_action_inbox;
alter function public.agent_dispatch_before_action_inbox(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_action_inbox(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.agent_dispatch_before_action_inbox(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 if operation<>'applications.inbox.read' then return private.agent_dispatch_before_action_inbox(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_action_inbox(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
 return private.read_action_inbox(c.user_id,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_inbox;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['public.action_inbox']||private.workspace_reset_tables_before_inbox();
$$;
revoke all on function private.workspace_reset_tables() from public,anon,authenticated;


-- Preserve the existing human progress boundary. An agent's applications.record
-- and raw status changes never call this human-only wrapper.
alter function private.set_application_stage(uuid,integer,text,text) rename to set_application_stage_before_inbox;
revoke all on function private.set_application_stage_before_inbox(uuid,integer,text,text) from public,anon,authenticated;
create function private.set_application_stage(p_application_id uuid,expected_revision integer,target_status text,note text)
returns public.applications language plpgsql security definer set search_path='' as $$
declare a public.applications;
begin
 a:=private.set_application_stage_before_inbox(p_application_id,expected_revision,target_status,note);
 if target_status='Submitted' and a.user_id=auth.uid() then
  if length(trim(coalesce(note,''))) not between 1 and 2000 then raise exception 'Verification note required' using errcode='22023';end if;
  update public.action_inbox set resolved_at=now(),resolution='user_reported_submitted'
  where application_id=a.id and user_id=auth.uid() and kind='check_submission' and resolved_at is null;
 end if;
 return a;
end $$;
revoke all on function private.set_application_stage(uuid,integer,text,text) from public,anon;
grant execute on function private.set_application_stage(uuid,integer,text,text) to authenticated;
