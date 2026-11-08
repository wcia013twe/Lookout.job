-- Explicit application routing is separate from connection permissions and claims.
create table private.application_agent_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 connection_id uuid not null references private.agent_connections(id) on delete cascade,
 version integer not null default 1 check(version>0),updated_at timestamptz not null default now()
);
alter table private.application_agent_preferences enable row level security;
revoke all on private.application_agent_preferences from public,anon,authenticated;
grant all on private.application_agent_preferences to service_role;

create function private.read_application_agent(owner_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p private.application_agent_preferences;c private.agent_connections;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into p from private.application_agent_preferences where user_id=owner_id;
 select * into c from private.agent_connections where id=p.connection_id and user_id=owner_id;
 return jsonb_build_object('connectionId',p.connection_id,'connectionName',c.name,'version',coalesce(p.version,0),'updatedAt',p.updated_at,'available',coalesce(c.revoked_at is null and c.expires_at>now() and c.scopes @> array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'],false));
end $$;
create function private.select_application_agent(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p private.application_agent_preferences;c private.agent_connections;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['connectionId','expectedVersion']<>'{}' or jsonb_typeof(payload->'connectionId') is distinct from 'string' or coalesce(payload->>'connectionId','') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' then raise exception 'Owned connection and current routing version required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,98));
 select * into p from private.application_agent_preferences where user_id=owner_id for update;
 if coalesce(p.version,0)<>(payload->>'expectedVersion')::integer then raise exception 'Application agent changed; read again' using errcode='40001';end if;
 select * into c from private.agent_connections where id=(payload->>'connectionId')::uuid and user_id=owner_id and revoked_at is null and expires_at>now() and scopes @> array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'] for share;
 if not found then raise exception 'Choose an active owned agent with application permissions' using errcode='42501';end if;
 if p.connection_id is distinct from c.id then
  insert into private.application_agent_preferences(user_id,connection_id) values(owner_id,c.id)
  on conflict(user_id) do update set connection_id=excluded.connection_id,version=private.application_agent_preferences.version+1,updated_at=now();
 end if;
 return private.read_application_agent(owner_id);
end $$;
create function private.resolve_application_agent(owner_id uuid,caller_connection uuid) returns uuid
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare selected uuid;eligible uuid[];
begin
 select connection_id into selected from private.application_agent_preferences where user_id=owner_id;
 if not found then
  if caller_connection is not null then selected:=caller_connection;
  else
   select array_agg(id) into eligible from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now() and scopes @> array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'];
   if coalesce(cardinality(eligible),0)<>1 then raise exception 'Choose your AI Apply agent in My Agent before queueing' using errcode='42501';end if;
   selected:=eligible[1];
  end if;
 end if;
 perform 1 from private.agent_connections where id=selected and user_id=owner_id and revoked_at is null and expires_at>now() and scopes @> array['workspace:read','preferences:write','drafts:write','approvals:read','resumes:read'] for share;
 if not found then raise exception 'Selected AI Apply agent is unavailable; choose an active agent in My Agent' using errcode='42501';end if;
 return selected;
end $$;
revoke all on function private.read_application_agent(uuid),private.select_application_agent(uuid,jsonb),private.resolve_application_agent(uuid,uuid) from public,anon,authenticated;
grant execute on function private.read_application_agent(uuid),private.select_application_agent(uuid,jsonb),private.resolve_application_agent(uuid,uuid) to service_role;
create function public.read_application_agent() returns jsonb language sql security definer set search_path='' as $$ select private.read_application_agent(auth.uid()) $$;
create function public.select_application_agent(payload jsonb) returns jsonb language sql security definer set search_path='' as $$ select private.select_application_agent(auth.uid(),payload) $$;
revoke all on function public.read_application_agent(),public.select_application_agent(jsonb) from public,anon;
grant execute on function public.read_application_agent(),public.select_application_agent(jsonb) to authenticated;

alter function private.queue_application_job(uuid,uuid,jsonb) rename to queue_application_before_agent_selection;
create function private.queue_application_job(owner_id uuid,bound_connection uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,98));
 return private.queue_application_before_agent_selection(owner_id,private.resolve_application_agent(owner_id,bound_connection),payload);
end $$;
revoke all on function private.queue_application_job(uuid,uuid,jsonb),private.queue_application_before_agent_selection(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.queue_application_job(uuid,uuid,jsonb),private.queue_application_before_agent_selection(uuid,uuid,jsonb) to service_role;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_application_agent;
alter function public.agent_dispatch_before_application_agent(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_application_agent(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.agent_dispatch_before_application_agent(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 if operation not in ('applications.agent.read','applications.agent.select') then return private.agent_dispatch_before_application_agent(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_application_agent(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) or (operation='applications.agent.select' and not 'preferences:write'=any(c.scopes)) then raise exception 'Application agent preference scope required' using errcode='42501';end if;
 if operation='applications.agent.read' then
  if payload is distinct from '{}'::jsonb then raise exception 'No routing read arguments accepted' using errcode='22023';end if;
  return private.read_application_agent(c.user_id);
 end if;
 return private.select_application_agent(c.user_id,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_application_agent;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['private.application_agent_preferences']::text[] || private.workspace_reset_tables_before_application_agent()
$$;
revoke all on function private.workspace_reset_tables(),private.workspace_reset_tables_before_application_agent() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on private.application_agent_preferences for each row execute function private.workspace_reset_write_guard();
