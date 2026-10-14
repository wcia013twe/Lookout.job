begin;
-- One shared write boundary; no new profile table or arbitrary preference patch.
create function private.save_search_profile_for_owner(owner_id uuid, expected_version integer, next_profile jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs public.preferences; current_profile jsonb; items jsonb; result jsonb; k text; v jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(next_profile) is distinct from 'object' or octet_length(next_profile::text)>30000
 or not (next_profile ?& array['id','name','active','filters','priorities','instructions'])
 or exists(select 1 from jsonb_object_keys(next_profile) x where x not in ('id','name','active','filters','priorities','instructions'))
 or coalesce(next_profile->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
 or jsonb_typeof(next_profile->'name') is distinct from 'string' or length(trim(next_profile->>'name')) not between 1 and 80
 or jsonb_typeof(next_profile->'active') is distinct from 'boolean'
 or jsonb_typeof(next_profile->'instructions') is distinct from 'string' or length(next_profile->>'instructions')>20000
 or jsonb_typeof(next_profile->'filters') is distinct from 'object'
 or jsonb_typeof(next_profile->'priorities') is distinct from 'object'
 or expected_version is null or expected_version<0 then raise exception 'Invalid profile' using errcode='22023'; end if;
 for k,v in select * from jsonb_each(next_profile->'filters') loop
  if k not in ('Employment','Work arrangement','Location','Minimum base pay','Schedule','Experience level')
   or jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>500 then raise exception 'Invalid filter' using errcode='22023'; end if;
 end loop;
 for k,v in select * from jsonb_each(next_profile->'priorities') loop
  if k not in ('Pay','Stability','Flexibility','Growth','Meaningful work','Team quality','Getting employed quickly')
   or (v#>>'{}') not in ('Important','Very important') or jsonb_typeof(v) is distinct from 'string' then raise exception 'Invalid priority' using errcode='22023'; end if;
 end loop;
 insert into public.preferences(user_id) values(owner_id) on conflict(user_id) do nothing;
 select * into prefs from public.preferences where user_id=owner_id for update;
 items:=coalesce(prefs.search->'profiles','[]');
 select x into current_profile from jsonb_array_elements(items) x where x->>'id'=next_profile->>'id';
 if coalesce((current_profile->>'version')::integer,0) is distinct from expected_version then raise exception 'Profile changed; reload' using errcode='40001'; end if;
 if current_profile is null and jsonb_array_length(items)>=20 then raise exception 'Profile limit reached' using errcode='22023'; end if;
 result:=next_profile||jsonb_build_object('version',expected_version+1);
 select coalesce(jsonb_agg(case when x->>'id'=result->>'id' then result else x end),'[]') into items from jsonb_array_elements(items) x;
 if current_profile is null then items:=items||jsonb_build_array(result); end if;
 update public.preferences set search=jsonb_set(coalesce(search,'{}'),'{profiles}',items),updated_at=now() where user_id=owner_id;
 return result;
end $$;
revoke all on function private.save_search_profile_for_owner(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.save_search_profile_for_owner(uuid,integer,jsonb) to service_role;

create function public.save_search_profile(expected_version integer,next_profile jsonb)
returns jsonb language sql security definer set search_path='' as $$
 select private.save_search_profile_for_owner(auth.uid(),expected_version,next_profile);
$$;
revoke all on function public.save_search_profile(integer,jsonb) from public,anon;
grant execute on function public.save_search_profile(integer,jsonb) to authenticated;

-- Existing workspace autosync must not overwrite profiles edited through MCP.
create function public.save_workspace_preferences(next_search jsonb,next_tier_lists jsonb,next_active_tier_list_id text,next_theme jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
declare result public.preferences;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into result from public.preferences where user_id=auth.uid() for update;
 update public.preferences set search=(coalesce(next_search,'{}')-'profiles') ||
 case when result.search ? 'profiles' then jsonb_build_object('profiles',result.search->'profiles') else '{}'::jsonb end,
 tier_lists=next_tier_lists,active_tier_list_id=next_active_tier_list_id,theme=next_theme,updated_at=now()
 where user_id=auth.uid() returning * into result;
 return result;
end $$;
revoke all on function public.save_workspace_preferences(jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.save_workspace_preferences(jsonb,jsonb,text,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to search_profiles_dispatch_previous;
revoke all on function private.search_profiles_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'preferences.profile.save' then return private.search_profiles_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'preferences:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('expectedVersion','profile')) then raise exception 'Invalid arguments' using errcode='22023'; end if;
 return private.save_search_profile_for_owner(c.user_id,(payload->>'expectedVersion')::integer,payload->'profile');
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('workspace:read','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
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
