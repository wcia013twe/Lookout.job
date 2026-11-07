-- Human gateway owns scope edits; preserve the existing token, expiry and identity.
alter function public.manage_agent_connection(uuid,text,jsonb) rename to manage_agent_connection_before_permissions;
alter function public.manage_agent_connection_before_permissions(uuid,text,jsonb) set schema private;
revoke all on function private.manage_agent_connection_before_permissions(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.manage_agent_connection_before_permissions(uuid,text,jsonb) to service_role;
create function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; requested text[]; expected text[]; allowed text[]:=array['knowledge:read','knowledge:write','answers:write','resumes:write','network:write','tracking:write','preferences:write','workspace:read','profile:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'];
begin
 if operation<>'connections.permissions' then return private.manage_agent_connection_before_permissions(owner_id,operation,payload);end if;
 if jsonb_typeof(payload) is distinct from 'object' or (payload-array['id','scopes','expectedScopes'])<>'{}'::jsonb
  or jsonb_typeof(payload->'scopes') is distinct from 'array' or jsonb_typeof(payload->'expectedScopes') is distinct from 'array'
  then raise exception 'Invalid permissions' using errcode='22023';end if;
 requested:=array(select jsonb_array_elements_text(payload->'scopes'));expected:=array(select jsonb_array_elements_text(payload->'expectedScopes'));
 if cardinality(requested)<1 or cardinality(expected)<1 or not requested<@allowed or not expected<@allowed
  or exists(select 1 from unnest(requested||expected) s where s is null)
  or cardinality(requested)<>(select count(distinct s) from unnest(requested) s)
  or cardinality(expected)<>(select count(distinct s) from unnest(expected) s)
  then raise exception 'Invalid permissions' using errcode='22023';end if;
 select * into c from private.agent_connections where id=(payload->>'id')::uuid and user_id=owner_id and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'Active owned connection not found' using errcode='P0002';end if;
 if not (c.scopes@>expected and c.scopes<@expected) then raise exception 'Permissions changed elsewhere' using errcode='40001';end if;
 update private.agent_connections set scopes=requested where id=c.id and user_id=owner_id returning * into c;
 return to_jsonb(c)-'token_hash';
end $$;
revoke all on function public.manage_agent_connection(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_agent_connection(uuid,text,jsonb) to service_role;
