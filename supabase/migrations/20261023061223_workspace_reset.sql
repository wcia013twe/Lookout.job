begin;
-- Reset is a human-only, resumable operation. Keep Auth, community records and
-- monotonic context versions. Never delete storage.objects metadata directly.
create table private.workspace_resets (
 user_id uuid primary key references auth.users on delete cascade,
 id uuid not null unique, state text not null check(state in ('pending','completed')),
 started_at timestamptz not null default clock_timestamp(), completed_at timestamptz,
 blocked_paths text[] not null default '{}'
);
create table private.workspace_reset_receipts (
 user_id uuid not null references auth.users on delete cascade,id uuid not null,
 completed_at timestamptz not null,primary key(user_id,id)
);
alter table private.workspace_reset_receipts enable row level security;
revoke all on private.workspace_reset_receipts from public,anon,authenticated;
alter table private.workspace_resets enable row level security;
revoke all on private.workspace_resets from public,anon,authenticated;

create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array[
 'public.activity_events','public.approvals','public.submission_attempts','public.application_milestones',
 'public.preparation_plans','public.preparation_sessions','public.preparation_planner_settings',
 'public.career_toolkit_results','private.career_toolkit_files',
 'public.applications','public.batch_items','public.job_batches',
 'public.search_observations','public.search_screenings','public.search_source_attempts','public.search_runs',
 'public.search_listings','public.search_document_revisions','public.search_documents','private.search_requests',
 'public.career_artifact_revisions','public.career_artifacts','public.learning_goals',
 'public.company_workspaces','public.outreach_contacts','public.outreach_requests',
 'public.selection_decisions','public.notification_deliveries','public.leaderboard_entries',
 'private.agent_tasks','private.onboarding_events','private.onboarding_sessions',
 'private.agent_resume_uploads','private.agent_profile_imports','private.resume_upload_intents',
 'public.answer_library','public.resumes','public.profiles','public.preferences']::text[]
$$;
revoke all on function private.workspace_reset_tables() from public,anon,authenticated;

-- All workspace writers serialize against reset preparation/finalization. Pending
-- resets reject writes, including signed uploads issued before reset started.
create function private.workspace_reset_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; pending boolean;
begin
 if tg_table_schema='storage' then
  if new.bucket_id <> 'resumes' then return new; end if;
  if split_part(new.name,'/',1) !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then return new; end if;
  target:=split_part(new.name,'/',1)::uuid;
 else target:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,241023));
 if tg_table_schema='storage' then
  if exists(select 1 from private.workspace_resets where user_id=target and new.name=any(blocked_paths)) then raise exception 'Upload invalidated by workspace reset' using errcode='55000'; end if;
 end if;
 -- Reject an authenticated write already in flight with a pre-reset JWT even
 -- if it reaches the database after finalization. Fresh sessions still hydrate
 -- the reset epoch before the browser can autosync cached drafts.
 if current_setting('role')='authenticated' and exists(
  select 1 from private.workspace_resets where user_id=target and state='completed'
   and coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iat','0')::numeric <= extract(epoch from completed_at)
 ) then raise exception 'Workspace was reset. Sign in again before editing.' using errcode='55000'; end if;
 select state='pending' into pending from private.workspace_resets where user_id=target;
 if pending and (tg_op <> 'DELETE' or current_setting('role')='authenticated') then
  raise exception 'Workspace reset is incomplete. Finish reset before editing.' using errcode='55000';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.workspace_reset_write_guard() from public,anon,authenticated;
DO $$ declare t text; begin
 foreach t in array private.workspace_reset_tables()||array['private.agent_connections'] loop
  execute format('create trigger workspace_reset_guard before insert or update or delete on %s for each row execute function private.workspace_reset_write_guard()',t);
 end loop;
end $$;
create trigger workspace_reset_guard before insert or update on storage.objects for each row execute function private.workspace_reset_write_guard();

create function public.workspace_reset_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid:=auth.uid(); result jsonb;
begin
 if target is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select jsonb_build_object('id',id,'state',state,'completedAt',completed_at) into result from private.workspace_resets where user_id=target;
 return coalesce(result,'{}');
end $$;
revoke all on function public.workspace_reset_state() from public,anon;
grant execute on function public.workspace_reset_state() to authenticated;

create function private.workspace_reset_service(target uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text; n bigint; counts jsonb:='{}'; files jsonb; s private.workspace_resets; version bigint;
begin
 if target is null or not exists(select 1 from auth.users where id=target) then raise exception 'Account not found' using errcode='42501'; end if;
 if operation not in ('preview','begin','finish') or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Invalid reset request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,241023));
 select * into s from private.workspace_resets where user_id=target;
 select coalesce((select v.version from private.agent_settings_versions v where user_id=target),1) into version;
 if operation in ('begin','finish') and exists(select 1 from private.workspace_reset_receipts where user_id=target and id=(payload->>'resetId')::uuid) then
  return jsonb_build_object('resetId',payload->>'resetId','state','completed','completedAt',(select completed_at from private.workspace_reset_receipts where user_id=target and id=(payload->>'resetId')::uuid));
 end if;
 if operation='begin' then
  if payload->>'confirmation' is distinct from 'RESET MY WORKSPACE' or payload->>'resetId' is null then raise exception 'Human confirmation required' using errcode='22023'; end if;
  if s.id is distinct from (payload->>'resetId')::uuid then
   if s.state='pending' then raise exception 'Resume the pending reset' using errcode='40001'; end if;
   if (payload->>'expectedPersonalVersion')::bigint is distinct from version then raise exception 'Workspace changed. Preview again.' using errcode='40001'; end if;
   -- Revoke before pending guard starts; retain minimal connection IDs because
   -- shared Circle revisions may reference them. No usable credential survives.
   update private.agent_connections set revoked_at=coalesce(revoked_at,clock_timestamp()),name='Revoked by workspace reset',scopes='{}' where user_id=target;
   insert into private.workspace_resets(user_id,id,state) values(target,(payload->>'resetId')::uuid,'pending')
    on conflict(user_id) do update set id=excluded.id,state='pending',started_at=clock_timestamp(),completed_at=null;
   update private.workspace_resets set blocked_paths=blocked_paths||array(
    select name from storage.objects where bucket_id='resumes' and split_part(name,'/',1)=target::text
    union select target::text||'/'||id::text||'.'||extension from private.agent_resume_uploads where user_id=target
    union select target::text||'/'||id::text||'.'||(metadata->>'fileType') from private.resume_upload_intents where user_id=target
    union select object_path from private.career_toolkit_files where user_id=target
   ) where user_id=target;
   select * into s from private.workspace_resets where user_id=target;
  end if;
 elsif operation='finish' then
  if s.id is null or s.id is distinct from (payload->>'resetId')::uuid then raise exception 'Reset not found' using errcode='40001'; end if;
  if s.state='pending' then
   if exists(select 1 from storage.objects where bucket_id='resumes' and split_part(name,'/',1)=target::text) then raise exception 'Private files remain. Retry reset.' using errcode='55000'; end if;
   foreach t in array private.workspace_reset_tables() loop
    execute format('delete from %s where user_id=$1',t) using target;
   end loop;
   foreach t in array private.workspace_reset_tables() loop
    execute format('select count(*) from %s where user_id=$1',t) into n using target;
    if n<>0 then raise exception 'Workspace records remain' using errcode='55000'; end if;
   end loop;
   update private.workspace_resets set state='completed',completed_at=clock_timestamp() where user_id=target returning * into s;
   insert into private.workspace_reset_receipts(user_id,id,completed_at) values(target,s.id,s.completed_at);
  end if;
 end if;
 foreach t in array private.workspace_reset_tables() loop
  execute format('select count(*) from %s where user_id=$1',t) into n using target;
  counts:=counts||jsonb_build_object(t,n);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('bucket',bucket_id,'name',name) order by name),'[]') into files
 from storage.objects where bucket_id='resumes' and split_part(name,'/',1)=target::text;
 return jsonb_build_object('resetId',s.id,'state',coalesce(s.state,'ready'),'completedAt',s.completed_at,'personalVersion',version,'counts',counts,'files',files,
  'preserved',jsonb_build_array('Login account','Shared Circle content and memberships','Internal version counters','Revoked connection references'));
end $$;
revoke all on function private.workspace_reset_service(uuid,text,jsonb) from public,anon,authenticated;
create function public.workspace_reset_service(owner_id uuid,operation text,payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select private.workspace_reset_service(owner_id,operation,payload) $$;
revoke all on function public.workspace_reset_service(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.workspace_reset_service(uuid,text,jsonb),public.workspace_reset_service(uuid,text,jsonb) to service_role;
commit;
