begin;
-- One narrowly scoped mutation shared by signed-in people and credentialed agents.
create function private.reconsider_selection_owned(owner_id uuid, decision_id uuid, expected_at text)
returns public.selection_decisions language plpgsql security definer set search_path='' as $$
declare d public.selection_decisions;
begin
 select * into d from public.selection_decisions where id=decision_id and user_id=owner_id for update;
 if not found then raise exception 'Owned decision not found' using errcode='P0002'; end if;
 if d.reconsidered_at is distinct from nullif(expected_at,'')::timestamptz then raise exception 'Selection changed; reload' using errcode='40001'; end if;
 update public.selection_decisions set reconsidered_at=clock_timestamp() where id=d.id returning * into d;
 return d;
end $$;
revoke all on function private.reconsider_selection_owned(uuid,uuid,text) from public,anon,authenticated;
grant execute on function private.reconsider_selection_owned(uuid,uuid,text) to service_role;
revoke update(reconsidered_at) on public.selection_decisions from authenticated;
create function public.reconsider_selection(decision_id uuid, expected_at text)
returns public.selection_decisions language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.reconsider_selection_owned(auth.uid(),decision_id,expected_at);
end $$;
revoke all on function public.reconsider_selection(uuid,text) from public,anon;
grant execute on function public.reconsider_selection(uuid,text) to authenticated;

create function private.quiet_mode_owned(owner_id uuid, next_settings jsonb default null, expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_version bigint; settings jsonb;
begin
 -- Match profile-import lock order: preferences, then personal version.
 perform 1 from public.preferences where user_id=owner_id for update;
 -- Materialize version 1 so concurrent first writes cannot both pass an absent-row check.
 insert into private.agent_settings_versions(user_id,version) values(owner_id,1) on conflict(user_id) do nothing;
 perform 1 from private.agent_settings_versions where user_id=owner_id for update;
 current_version:=coalesce((select v.version from private.agent_settings_versions v where v.user_id=owner_id),1);
 if next_settings is not null then
  if expected_version is distinct from current_version then raise exception 'Settings changed; reload' using errcode='40001'; end if;
  if jsonb_typeof(next_settings) is distinct from 'object' or next_settings-'cadence'-'timezone'-'digestHour'-'digestDay'-'urgentDeadlineHours'<>'{}'::jsonb
   or coalesce(next_settings->>'cadence','') not in ('immediate','daily','weekly')
   or not exists(select 1 from pg_catalog.pg_timezone_names where name=next_settings->>'timezone')
   or jsonb_typeof(next_settings->'digestHour') is distinct from 'number' or coalesce(next_settings->>'digestHour','') !~ '^[0-9]+$' or (next_settings->>'digestHour')::integer not between 0 and 23
   or jsonb_typeof(next_settings->'digestDay') is distinct from 'number' or coalesce(next_settings->>'digestDay','') !~ '^[0-9]+$' or (next_settings->>'digestDay')::integer not between 0 and 6
   or jsonb_typeof(next_settings->'urgentDeadlineHours') is distinct from 'number' or coalesce(next_settings->>'urgentDeadlineHours','') !~ '^[0-9]+$' or (next_settings->>'urgentDeadlineHours')::integer not between 1 and 168
  then raise exception 'Invalid quiet settings' using errcode='22023'; end if;
  insert into public.preferences(user_id,search) values(owner_id,jsonb_build_object('quietMode',next_settings))
   on conflict(user_id) do update set search=public.preferences.search||jsonb_build_object('quietMode',next_settings),updated_at=now();
  current_version:=coalesce((select v.version from private.agent_settings_versions v where v.user_id=owner_id),1);
 end if;
 settings:=coalesce((select p.search->'quietMode' from public.preferences p where p.user_id=owner_id),'{}'::jsonb);
 return jsonb_build_object('settings',settings,'personalVersion',current_version);
end $$;
revoke all on function private.quiet_mode_owned(uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function private.quiet_mode_owned(uuid,jsonb,bigint) to service_role;
create function public.read_quiet_mode() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.quiet_mode_owned(auth.uid());
end $$;
create function public.save_quiet_mode(next_settings jsonb,expected_version bigint) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.quiet_mode_owned(auth.uid(),next_settings,expected_version);
end $$;
revoke all on function public.read_quiet_mode(),public.save_quiet_mode(jsonb,bigint) from public,anon;
grant execute on function public.read_quiet_mode(),public.save_quiet_mode(jsonb,bigint) to authenticated;

-- Generic browser preference sync must not overwrite a newer quiet-mode RPC.
create function public.save_preferences_preserving_quiet(search_next jsonb, lists_next jsonb, active_next text, theme_next jsonb)
returns public.preferences language plpgsql security definer set search_path='' as $$
declare p public.preferences; next_search jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(search_next) is distinct from 'object' or jsonb_typeof(lists_next) is distinct from 'array' or jsonb_typeof(theme_next) is distinct from 'object'
  or octet_length(search_next::text)>100000 or octet_length(lists_next::text)>1000000 or octet_length(theme_next::text)>10000
 then raise exception 'Invalid preferences' using errcode='22023'; end if;
 -- Create missing row before locking so simultaneous first saves serialize.
 insert into public.preferences(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into p from public.preferences where user_id=auth.uid() for update;
 next_search:=search_next-'quietMode';
 if p.search ? 'quietMode' then next_search:=next_search||jsonb_build_object('quietMode',p.search->'quietMode'); end if;
 update public.preferences set search=next_search,tier_lists=lists_next,active_tier_list_id=active_next,theme=theme_next,updated_at=now()
 where user_id=auth.uid() returning * into p;
 return p;
end $$;
revoke all on function public.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to muse_parity_previous;
revoke all on function private.muse_parity_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.muse_parity_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; a public.applications; needed text;
begin
 if operation not in ('selection.reconsider','quiet.read','quiet.update','applications.human_action') then return private.muse_parity_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 needed:=case when operation='selection.reconsider' then 'activity:write' when operation='quiet.update' then 'profile:write' else 'workspace:read' end;
 if not needed=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation='selection.reconsider' then
  if not payload ? 'expectedReconsideredAt' then raise exception 'Selection token required' using errcode='22023'; end if;
  return to_jsonb(private.reconsider_selection_owned(c.user_id,(payload->>'decisionId')::uuid,payload->>'expectedReconsideredAt'));
 elsif operation='quiet.read' then return private.quiet_mode_owned(c.user_id);
 elsif operation='quiet.update' then
  if jsonb_typeof(payload->'settings') is distinct from 'object' then raise exception 'Quiet settings required' using errcode='22023'; end if;
  return private.quiet_mode_owned(c.user_id,payload->'settings',(payload->>'expectedPersonalVersion')::bigint);
 end if;
 select * into a from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if coalesce(payload->>'action','') not in ('approve','resolve_submission') then raise exception 'Human action required' using errcode='22023'; end if;
 return jsonb_build_object('applicationId',a.id,'revision',a.revision,'action',payload->>'action','humanOnly',true,'performed',false,
 'boardUrl','https://wcia013twe.github.io/codex-automated-job-board/applications/?application='||a.id,
 'message',case when payload->>'action'='approve' then 'The signed-in user must inspect and approve this exact draft in Muse. This tool never grants approval.' else 'The signed-in user must verify the employer portal or confirmation email and resolve the uncertain attempt in Muse. This tool never resolves or retries a submission.' end);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
