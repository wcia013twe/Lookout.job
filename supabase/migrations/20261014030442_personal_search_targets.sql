begin;
create function private.save_search_targets_for_owner(owner_id uuid, expected_version integer, next_targets jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs public.preferences; t jsonb; result jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if expected_version is null or expected_version<0 or jsonb_typeof(next_targets) is distinct from 'array' or jsonb_array_length(next_targets)>100 then raise exception 'Invalid targets' using errcode='22023'; end if;
 for t in select * from jsonb_array_elements(next_targets) loop
  if jsonb_typeof(t) is distinct from 'object' or not(t ?& array['id','name','kind','address'])
   or exists(select 1 from jsonb_object_keys(t) k where k not in ('id','name','kind','address'))
   or jsonb_typeof(t->'id') is distinct from 'string' or coalesce(t->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$'
   or jsonb_typeof(t->'name') is distinct from 'string' or length(trim(t->>'name')) not between 1 and 120
   or coalesce(t->>'kind','') not in ('board','careers','social')
   or jsonb_typeof(t->'address') is distinct from 'string' or length(t->>'address')>2048
   or not ((t->>'address') ~ '^https://[^[:space:]/]+[^[:space:]]*$' or (t->>'kind'='social' and (t->>'address') ~ '^@[a-zA-Z0-9_.]{1,80}$'))
  then raise exception 'Invalid target fields' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(next_targets) entry group by entry->>'id' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(next_targets) entry group by entry->>'kind',lower(regexp_replace(entry->>'address','/$','')) having count(*)>1)
 then raise exception 'Duplicate target' using errcode='22023'; end if;
 insert into public.preferences(user_id) values(owner_id) on conflict(user_id) do nothing;
 select * into prefs from public.preferences where user_id=owner_id for update;
 if coalesce((prefs.search->>'targetsVersion')::integer,0)<>expected_version then raise exception 'Targets changed; reload' using errcode='40001'; end if;
 result:=jsonb_build_object('targets',next_targets,'version',expected_version+1);
 update public.preferences set search=coalesce(search,'{}')||jsonb_build_object('targets',next_targets,'targetsVersion',expected_version+1),updated_at=now() where user_id=owner_id;
 return result;
end $$;
revoke all on function private.save_search_targets_for_owner(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.save_search_targets_for_owner(uuid,integer,jsonb) to service_role;
create function public.save_search_targets(expected_version integer,next_targets jsonb)
returns jsonb language sql security definer set search_path='' as $$ select private.save_search_targets_for_owner(auth.uid(),expected_version,next_targets); $$;
revoke all on function public.save_search_targets(integer,jsonb) from public,anon;
grant execute on function public.save_search_targets(integer,jsonb) to authenticated;

-- Autosync preserves separately versioned targets and profiles.
create or replace function public.save_workspace_preferences(next_search jsonb,next_tier_lists jsonb,next_active_tier_list_id text,next_theme jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
declare result public.preferences;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into result from public.preferences where user_id=auth.uid() for update;
 update public.preferences set search=(coalesce(next_search,'{}')-array['profiles','targets','targetsVersion']) ||
 (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(result.search,'{}')) where key in ('profiles','targets','targetsVersion')),
 tier_lists=next_tier_lists,active_tier_list_id=next_active_tier_list_id,theme=next_theme,updated_at=now()
 where user_id=auth.uid() returning * into result;
 return result;
end $$;
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to search_targets_dispatch_previous;
revoke all on function private.search_targets_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'preferences.targets.save' then return private.search_targets_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'preferences:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k not in ('expectedVersion','targets')) then raise exception 'Invalid arguments' using errcode='22023'; end if;
 return private.save_search_targets_for_owner(c.user_id,(payload->>'expectedVersion')::integer,payload->'targets');
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
