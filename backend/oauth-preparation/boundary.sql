-- OFFLINE PREPARATION ONLY. Not a migration or configured hook.
-- Caller must prove Auth account isolation and resource binding before activation.
create table private.mcp_oauth_bindings (
 user_id uuid not null references auth.users(id), client_id uuid not null,
 connection_id uuid not null references private.agent_connections(id),
 consent_id uuid not null, consent_granted_at timestamptz not null,
 resource text not null check(resource like 'https://%'),
 scopes text[] not null, created_at timestamptz not null default now(),
 expires_at timestamptz not null, revoked_at timestamptz,
 primary key(user_id,client_id)
);
alter table private.mcp_oauth_bindings enable row level security;
revoke all on private.mcp_oauth_bindings from public,anon,authenticated;
-- No client or human table grants. A future human-only writer must verify consent.
create function private.freeze_mcp_oauth_binding() returns trigger language plpgsql as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at')
 or old.revoked_at is not null or new.revoked_at is null then
 raise exception 'OAuth binding is immutable; revocation is terminal'; end if;
 return new;
end $$;
create trigger immutable_mcp_oauth_binding before update or delete on private.mcp_oauth_bindings
for each row execute function private.freeze_mcp_oauth_binding();
revoke all on function private.freeze_mcp_oauth_binding() from public;

-- Reads authoritative session, provider consent and existing connection together.
-- This function is not exposed as an RPC and returns no credential/hash.
create function private.resolve_mcp_oauth_binding(claims jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare b private.mcp_oauth_bindings; c private.agent_connections; s auth.sessions;
begin
 if exists(select 1 from pg_roles where rolname='lookout_mcp_no_database') then
   raise exception 'Reserved MCP role must not exist'; end if;
 select * into s from auth.sessions where id=(claims->>'session_id')::uuid;
 select * into b from private.mcp_oauth_bindings where user_id=(claims->>'sub')::uuid and client_id=(claims->>'client_id')::uuid;
 if b.user_id is null or s.id is null or s.user_id<>b.user_id or s.oauth_client_id is distinct from b.client_id
 or s.created_at<b.created_at or (s.not_after is not null and s.not_after<=now())
 or b.revoked_at is not null or b.expires_at<=now() then raise exception 'Inactive OAuth binding'; end if;
 if not exists(select 1 from auth.oauth_consents where id=b.consent_id and user_id=b.user_id
 and client_id=b.client_id and granted_at=b.consent_granted_at and revoked_at is null) then
 raise exception 'Inactive provider consent'; end if;
 select * into c from private.agent_connections where id=b.connection_id;
 if c.id is null or c.user_id<>b.user_id or c.revoked_at is not null or c.expires_at<=now()
 or c.scopes is distinct from b.scopes or b.expires_at>c.expires_at then raise exception 'Inactive connection'; end if;
 return jsonb_build_object('connection_id',c.id,'resource',b.resource,'expires_at',least(b.expires_at,c.expires_at),
 'scopes',b.scopes);
end $$;
revoke all on function private.resolve_mcp_oauth_binding(jsonb) from public,anon,authenticated;

-- Matches the provider CustomAccessTokenInput / Output contract on both flows.
create function private.mcp_oauth_token_hook(event jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; binding jsonb; s auth.sessions;
begin
 select * into s from auth.sessions where id=(claims->>'session_id')::uuid;
 -- Human sessions are unchanged; a missing client claim on an OAuth session is rejected.
 if s.oauth_client_id is null and coalesce(claims->>'client_id','')='' then
   return jsonb_build_object('claims',claims);
 end if;
 if coalesce(event->>'authentication_method','') not in ('oauth_provider/authorization_code','token_refresh')
 or event->>'user_id' is distinct from claims->>'sub' then raise exception 'Invalid OAuth hook input'; end if;
 binding:=private.resolve_mcp_oauth_binding(claims);
 -- Remove profile metadata and bind only to a non-existent DB role. PostgREST cannot SET ROLE.
 claims:=claims-'user_metadata'-'app_metadata'-'scope';
 claims:=claims || jsonb_build_object('aud',binding->>'resource','role','lookout_mcp_no_database',
 'email','','phone','','lookout_connection_id',binding->>'connection_id',
 'exp',least((claims->>'exp')::bigint,floor(extract(epoch from (binding->>'expires_at')::timestamptz))::bigint));
 return jsonb_build_object('claims',claims);
end $$;
revoke all on function private.mcp_oauth_token_hook(jsonb) from public,anon,authenticated;
-- Deliberately no hook execution grant, configuration or human consent writer yet.
