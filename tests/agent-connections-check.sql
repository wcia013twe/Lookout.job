begin;
-- Hosted service_role has BYPASSRLS; mirror that property in the local fixture.
alter role service_role bypassrls;
set local role service_role;
do $$
declare owner_a uuid:='11111111-1111-1111-1111-111111111111'; owner_b uuid:='22222222-2222-2222-2222-222222222222'; c jsonb; again jsonb; key_hash text:=repeat('c',64); count_before integer;
begin
  c:=public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name',' Connection test ','expiresInDays',30,'tokenHash',key_hash,'scopes',jsonb_build_array('workspace:read','profile:write','batches:write','drafts:write','activity:write','approvals:read','resumes:read')));
  if c ? 'token_hash' or c->>'name'<>'Connection test' or not (c->'scopes' ? 'profile:write') then raise exception 'Invalid issue response'; end if;
  perform public.agent_dispatch(key_hash,'credentials.verify','{}');
  if not (public.manage_agent_connection(owner_a,'connections.list','{}') @> jsonb_build_array(jsonb_build_object('id',c->>'id'))) then raise exception 'Issued connection absent'; end if;
  if public.manage_agent_connection(owner_b,'connections.list','{}') @> jsonb_build_array(jsonb_build_object('id',c->>'id')) then raise exception 'List leaked another owner'; end if;
  begin perform public.manage_agent_connection(owner_b,'connections.revoke',jsonb_build_object('id',c->>'id')); raise exception 'Cross-owner revoke succeeded'; exception when no_data_found then null; end;
  again:=public.manage_agent_connection(owner_a,'connections.profile_setup',jsonb_build_object('id',c->>'id','enabled',false));
  if again->'scopes' ? 'profile:write' then raise exception 'Setup access not disabled'; end if;
  again:=public.manage_agent_connection(owner_a,'connections.profile_setup',jsonb_build_object('id',c->>'id','enabled',true));
  if not (again->'scopes' ? 'profile:write') then raise exception 'Setup access not enabled'; end if;
  c:=public.manage_agent_connection(owner_a,'connections.revoke',jsonb_build_object('id',c->>'id'));
  if c->>'revoked_at' is null or c ? 'token_hash' then raise exception 'Revoke failed'; end if;
  again:=public.manage_agent_connection(owner_a,'connections.revoke',jsonb_build_object('id',c->>'id'));
  if again->>'revoked_at'<>c->>'revoked_at' then raise exception 'Revoke is not idempotent'; end if;
  begin perform public.agent_dispatch(key_hash,'credentials.verify','{}'); raise exception 'Revoked token accepted'; exception when invalid_authorization_specification then null; end;
  begin perform public.manage_agent_connection(owner_a,'connections.profile_setup',jsonb_build_object('id',c->>'id','enabled',true)); raise exception 'Revoked access reenabled'; exception when no_data_found then null; end;
  begin perform public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name','  ','tokenHash',repeat('d',64),'scopes',jsonb_build_array('workspace:read'))); raise exception 'Blank name accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name','Bad scope','tokenHash',repeat('d',64),'scopes',jsonb_build_array('admin:all'))); raise exception 'Unknown scope accepted'; exception when invalid_parameter_value then null; end;
  begin perform public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name','No scopes','tokenHash',repeat('d',64))); raise exception 'Missing scopes accepted'; exception when invalid_parameter_value then null; end;
  for i in 1..10 loop
    perform public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name','Limit test','tokenHash',lpad(i::text,64,'0'),'scopes',jsonb_build_array('workspace:read')));
  end loop;
  begin perform public.manage_agent_connection(owner_a,'connections.issue',jsonb_build_object('name','Too many','tokenHash',repeat('f',64),'scopes',jsonb_build_array('workspace:read'))); raise exception 'Active limit not enforced'; exception when invalid_parameter_value then null; end;
end $$;
rollback;
