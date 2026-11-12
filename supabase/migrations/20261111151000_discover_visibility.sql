begin;
-- Both transports call the same owner-scoped atomic mutation.
create function private.set_discover_visibility(owner_id uuid, job_id_arg text, visibility_arg text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.preferences;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if job_id_arg is null or length(job_id_arg) not between 1 and 2000 or visibility_arg not in ('hidden','visible') or visibility_arg is null then raise exception 'Invalid visibility' using errcode='22023'; end if;
 if not exists(select 1 from public.batch_items where user_id=owner_id and job_id=job_id_arg and dismissed_at is null) then raise exception 'Owned Discover role not found' using errcode='P0002'; end if;
 insert into public.preferences(user_id) values(owner_id) on conflict(user_id) do nothing;
 select * into p from public.preferences where user_id=owner_id for update;
 update public.preferences set search=jsonb_set(coalesce(search,'{}'::jsonb),'{discoverVisibility}',coalesce(search->'discoverVisibility','{}'::jsonb)||jsonb_build_object(job_id_arg,visibility_arg),true), updated_at=now() where user_id=owner_id returning * into p;
 return jsonb_build_object('jobId',job_id_arg,'visibility',visibility_arg,'updatedAt',p.updated_at);
end $$;
revoke all on function private.set_discover_visibility(uuid,text,text) from public,anon,authenticated;
create function public.set_discover_visibility(job_id_arg text,visibility_arg text) returns jsonb language sql security definer set search_path='' as $$ select private.set_discover_visibility(auth.uid(),job_id_arg,visibility_arg) $$;
revoke all on function public.set_discover_visibility(text,text) from public,anon;
grant execute on function public.set_discover_visibility(text,text) to authenticated;
-- Existing bulk preference saves preserve server-owned per-role visibility.
create or replace function private.save_preferences_authenticated(search_next jsonb, lists_next jsonb, active_next text, theme_next jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
declare p public.preferences; next_search jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(search_next) is distinct from 'object' or jsonb_typeof(lists_next) is distinct from 'array' or jsonb_typeof(theme_next) is distinct from 'object' or octet_length(search_next::text)>100000 or octet_length(lists_next::text)>1000000 or octet_length(theme_next::text)>10000 then raise exception 'Invalid preferences' using errcode='22023'; end if;
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into p from public.preferences where user_id=auth.uid() for update;
 next_search:=search_next-array['quietMode','profiles','targets','targetsVersion','onboarding','deliveryRequest','discoverVisibility'];
 next_search:=next_search||(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(coalesce(p.search,'{}')) where key in ('quietMode','profiles','targets','targetsVersion','onboarding','deliveryRequest','discoverVisibility'));
 update public.preferences set search=next_search,tier_lists=lists_next,active_tier_list_id=active_next,theme=theme_next,updated_at=now() where user_id=auth.uid() returning * into p;
 return p;
end $$;
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_discover_visibility;
alter function public.agent_dispatch_before_discover_visibility(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_discover_visibility(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 if operation<>'discover.visibility.set' then return private.agent_dispatch_before_discover_visibility(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_before_discover_visibility(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'activity:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& array['jobId','visibility'] or exists(select 1 from jsonb_object_keys(payload) k where k not in ('jobId','visibility')) or jsonb_typeof(payload->'jobId') is distinct from 'string' or jsonb_typeof(payload->'visibility') is distinct from 'string' then raise exception 'Invalid arguments' using errcode='22023'; end if;
 return private.set_discover_visibility(c.user_id,payload->>'jobId',payload->>'visibility');
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
