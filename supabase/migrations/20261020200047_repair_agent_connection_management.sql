-- Restore the current connection contract after older deployments replaced it.
-- Only the verified human gateway may issue, alter, list or revoke credentials.
create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 19));
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(coalesce(payload->>'name',''))) not between 1 and 80
      or coalesce(payload->>'tokenHash','') !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') is distinct from 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('knowledge:read','knowledge:write','workspace:read','profile:write','answers:write','network:write','tracking:write','resumes:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
      then raise exception 'Invalid connection' using errcode='22023'; end if;
    -- Limits accidental repeated provisioning; revoked/expired entries do not count.
    if (select count(*) from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now()) >= 10 then
      raise exception 'Revoke an existing connection first' using errcode='22023';
    end if;
    insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
      values(owner_id,trim(payload->>'name'),payload->>'tokenHash',array(select jsonb_array_elements_text(payload->'scopes')),now()+make_interval(days=>days)) returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.profile_setup' then
    if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Enabled boolean required' using errcode='22023'; end if;
    select * into connection from private.agent_connections where user_id=owner_id and id=(payload->>'id')::uuid and revoked_at is null and expires_at>now() for update;
    if not found then raise exception 'Active owned connection not found' using errcode='P0002'; end if;
    update private.agent_connections set scopes=case when (payload->>'enabled')::boolean then
      array(select distinct s from unnest(connection.scopes || array['profile:write']) s) else array_remove(connection.scopes,'profile:write') end
      where id=connection.id returning * into connection;
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
