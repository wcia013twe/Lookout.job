-- Two independent context versions. No resettable flag or per-agent dirty state.
create table private.agent_settings_versions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null default 1 check (version > 0)
);
alter table private.agent_settings_versions enable row level security;
revoke all on private.agent_settings_versions from public, anon, authenticated;
grant select on private.agent_settings_versions to service_role;

-- Trigger-only privileged write: callers cannot mint or reset versions.
create function private.bump_agent_settings_version() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new)-'updated_at') = (to_jsonb(old)-'updated_at') then return null; end if;
  owner_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  -- An Auth account cascade must not resurrect its version record.
  if not exists(select 1 from auth.users where id=owner_id) then return null; end if;
  insert into private.agent_settings_versions(user_id,version) values(owner_id,2)
    on conflict(user_id) do update set version=private.agent_settings_versions.version+1;
  return null;
end $$;
revoke all on function private.bump_agent_settings_version() from public, anon, authenticated;
create trigger agent_profile_context after insert or update or delete on public.profiles
  for each row execute function private.bump_agent_settings_version();
create trigger agent_preferences_context after insert or update or delete on public.preferences
  for each row execute function private.bump_agent_settings_version();
create trigger agent_resumes_context after insert or update or delete on public.resumes
  for each row execute function private.bump_agent_settings_version();
create trigger agent_answers_context after insert or update or delete on public.answer_library
  for each row execute function private.bump_agent_settings_version();

-- Keep existing gateway behavior in one internal function instead of copying it.
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to agent_dispatch_core;
revoke all on function private.agent_dispatch_core(text,text,jsonb) from public, anon, authenticated;
grant execute on function private.agent_dispatch_core(text,text,jsonb) to service_role;

create function public.agent_dispatch(credential_hash text, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; result jsonb;
begin
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
