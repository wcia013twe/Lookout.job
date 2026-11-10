begin;
-- Disabled until the reviewed host setup explicitly enables this single resource/client.
create table private.mcp_oauth_policy(singleton boolean primary key default true check(singleton),enabled boolean not null default false,resource text,client_id text,max_grant_seconds integer not null default 2592000 check(max_grant_seconds between 60 and 2592000));
insert into private.mcp_oauth_policy(singleton) values(true);
create table private.mcp_oauth_records(model text not null,key_hash text not null,payload jsonb not null,expires_at timestamptz not null,uid text,grant_id text,primary key(model,key_hash));
create index mcp_oauth_expiry on private.mcp_oauth_records(expires_at);
create index mcp_oauth_uid on private.mcp_oauth_records(model,uid) where uid is not null;
create index mcp_oauth_grant on private.mcp_oauth_records(grant_id) where grant_id is not null;
create table private.mcp_oauth_grants(id text primary key,user_id uuid not null references auth.users(id) on delete cascade,client_id text not null,connection_id uuid not null references private.agent_connections(id) on delete cascade,scopes text[] not null,resource text not null,expires_at timestamptz not null,revoked_at timestamptz);
create function private.freeze_mcp_host_grant() returns trigger language plpgsql as $$
begin
 if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at') or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then raise exception 'Grant binding is immutable';end if;
 return new;
end $$;
create trigger immutable_mcp_host_grant before update on private.mcp_oauth_grants for each row execute function private.freeze_mcp_host_grant();
revoke all on function private.freeze_mcp_host_grant() from public;
alter table private.mcp_oauth_policy enable row level security;
alter table private.mcp_oauth_records enable row level security;
alter table private.mcp_oauth_grants enable row level security;
revoke all on private.mcp_oauth_policy,private.mcp_oauth_records,private.mcp_oauth_grants from public,anon,authenticated;
grant all on private.mcp_oauth_policy,private.mcp_oauth_records,private.mcp_oauth_grants to service_role;
create function private.mcp_oauth_grant(id text) returns private.mcp_oauth_grants language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare g private.mcp_oauth_grants; c private.agent_connections; p private.mcp_oauth_policy;
begin
 select * into p from private.mcp_oauth_policy where singleton;
 select * into g from private.mcp_oauth_grants where mcp_oauth_grants.id=id for share;
 select * into c from private.agent_connections where agent_connections.id=g.connection_id for share;
 if not coalesce(p.enabled,false) or g.id is null or g.revoked_at is not null or g.expires_at<=now()
 or g.resource is distinct from p.resource or g.client_id is distinct from p.client_id
 or c.id is null or c.user_id<>g.user_id or c.revoked_at is not null or c.expires_at<=now()
 or c.scopes is distinct from g.scopes then raise exception 'OAuth grant unavailable' using errcode='28000';end if;
 return g;
end $$;
revoke all on function private.mcp_oauth_grant(text) from public,anon,authenticated;
-- Every existing scoped operation keeps its validation and transaction; only lookup is shared.
create function private.agent_connection_id(credential_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; item private.mcp_oauth_records; g private.mcp_oauth_grants;
begin
 select id into cid from private.agent_connections where token_hash=credential_hash;
 if cid is not null then return cid;end if;
 select * into item from private.mcp_oauth_records where model='AccessToken' and key_hash=credential_hash and expires_at>now();
 if item.key_hash is null then return null;end if;
 g:=private.mcp_oauth_grant(item.grant_id);
 if item.payload->>'aud' is distinct from g.resource or item.payload->>'clientId' is distinct from g.client_id
 or item.payload->>'accountId' is distinct from g.user_id::text then return null;end if;
 return g.connection_id;
end $$;
revoke all on function private.agent_connection_id(text) from public,anon,authenticated;
grant execute on function private.agent_connection_id(text) to service_role;
-- Replace only the two existing credential lookup expressions. No domain body is duplicated.
do $$ declare f record; body text; changed integer:=0;begin
 for f in select p.oid,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.proname<>'agent_connection_id'
 and p.prosrc ~ 'token_hash\s*=\s*(credential_hash|args->>''hash'')' loop
 body:=pg_get_functiondef(f.oid);
 body:=regexp_replace(body,'token_hash\s*=\s*credential_hash','id=(select private.agent_connection_id(credential_hash))','g');
 body:=regexp_replace(body,'token_hash\s*=\s*args->>''hash''','id=(select private.agent_connection_id(args->>''hash''))','g');
 execute body;changed:=changed+1;
 end loop;
 if changed=0 then raise exception 'Missing existing scoped credential lookups';end if;
end $$;

create function public.mcp_oauth_store(action text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare item private.mcp_oauth_records; g private.mcp_oauth_grants; c private.agent_connections; p private.mcp_oauth_policy; value jsonb; ttl integer; model text:=args->>'model'; hash text:=args->>'hash';
begin
 select * into p from private.mcp_oauth_policy where singleton;
 if action='readiness' then return to_jsonb(p);end if;
 if not p.enabled then raise exception 'OAuth disabled' using errcode='28000';end if;
 if action='complete' then
 insert into private.mcp_oauth_records(model,key_hash,payload,expires_at) values('ConsentUsed',args->>'hash','{}',now()+interval '1 hour') on conflict on constraint mcp_oauth_records_pkey do nothing;
 if not found then raise exception 'Interaction already completed';end if;return '{}';end if;
 if action='prune' then
 delete from private.mcp_oauth_records where expires_at<=now();return '{}';end if;
 if action='connections' then
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'scopes',scopes,'expiresAt',least(expires_at,now()+make_interval(secs=>p.max_grant_seconds)))) from private.agent_connections where user_id=(args->>'user')::uuid and revoked_at is null and expires_at>now()),'[]');end if;
 if action='bind' then
 select * into c from private.agent_connections where id=(args->>'connection')::uuid and user_id=(args->>'user')::uuid for share;
 if c.id is null or c.revoked_at is not null or c.expires_at<=now() or to_jsonb(c.scopes) is distinct from args->'scopes'
 or args->>'client' is distinct from p.client_id or args->>'resource' is distinct from p.resource then raise exception 'Consent changed' using errcode='42501';end if;
 insert into private.mcp_oauth_grants(id,user_id,client_id,connection_id,scopes,resource,expires_at)
 values(args->>'grant',c.user_id,p.client_id,c.id,c.scopes,p.resource,least(c.expires_at,now()+make_interval(secs=>p.max_grant_seconds),(args->>'expires')::timestamptz));
 return to_jsonb(private.mcp_oauth_grant(args->>'grant'));
 end if;
 if action='grant' then return to_jsonb(private.mcp_oauth_grant(args->>'grant'));end if;
 if action='revoke' then
 update private.mcp_oauth_grants set revoked_at=coalesce(revoked_at,now()) where id=args->>'grant';
 delete from private.mcp_event_subscriptions where oauth_grant_id=args->>'grant';
 delete from private.mcp_oauth_records where grant_id=args->>'grant';return '{}';end if;
 if model not in ('Session','Interaction','AuthorizationCode','AccessToken','RefreshToken','Grant','ConsentTicket','ConsentFinish') or hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid OAuth storage key';end if;
 if action='upsert' then
 delete from private.mcp_oauth_records r where (r.model,r.key_hash) in (select e.model,e.key_hash from private.mcp_oauth_records e where e.expires_at<=now() order by e.expires_at limit 100);
 if model in ('Interaction','ConsentTicket','ConsentFinish') and (select count(*) from private.mcp_oauth_records r where r.model=model)>=10000 and not exists(select 1 from private.mcp_oauth_records r where r.model=model and r.key_hash=hash) then raise exception 'OAuth capacity reached';end if;
 value:=args->'payload';ttl:=(args->>'ttl')::integer;
 if jsonb_typeof(value)<>'object' or value ? 'jti' or ttl not between 1 and 2592000 then raise exception 'Invalid OAuth record';end if;
 if model in ('Grant','AuthorizationCode','AccessToken','RefreshToken') then
 g:=private.mcp_oauth_grant(args->>'grant');
 if value->>'clientId' is distinct from g.client_id or value->>'accountId' is distinct from g.user_id::text then raise exception 'Grant identity mismatch';end if;
 if model='AccessToken' and value->>'aud' is distinct from g.resource then raise exception 'Wrong resource';end if;
 end if;
 insert into private.mcp_oauth_records(model,key_hash,payload,expires_at,uid,grant_id)
 values(model,hash,value,least(now()+make_interval(secs=>ttl),coalesce(g.expires_at,'infinity'::timestamptz),coalesce(to_timestamp((value->>'exp')::double precision),'infinity'::timestamptz)),value->>'uid',args->>'grant')
 on conflict on constraint mcp_oauth_records_pkey do update set payload=excluded.payload,expires_at=excluded.expires_at,uid=excluded.uid,grant_id=excluded.grant_id
 where private.mcp_oauth_records.payload->'consumed' is null;
 return '{}';
 elsif action in ('find','uid','take','consume','destroy') then
 select * into item from private.mcp_oauth_records r where r.model=model
 and ((action='uid' and r.uid=args->>'uid') or (action<>'uid' and r.key_hash=hash)) and r.expires_at>now() for update;
 if item.key_hash is null then return null;end if;
 if item.grant_id is not null then perform private.mcp_oauth_grant(item.grant_id);end if;
 if action='destroy' then delete from private.mcp_oauth_records where mcp_oauth_records.model=model and key_hash=item.key_hash;return '{}';end if;
 if action='consume' then
 if item.payload ? 'consumed' then return jsonb_build_object('replayed',true,'grant',item.grant_id);end if;
 update private.mcp_oauth_records set payload=payload||jsonb_build_object('consumed',extract(epoch from now())::bigint) where mcp_oauth_records.model=model and key_hash=item.key_hash;
 return '{}';end if;
 if action='take' then delete from private.mcp_oauth_records where mcp_oauth_records.model=model and key_hash=item.key_hash;end if;
 return item.payload;
 end if;
 raise exception 'Unknown OAuth action';
end $$;
revoke all on function public.mcp_oauth_store(text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_oauth_store(text,jsonb) to service_role;

-- Attach authorization to subscriptions, not access-token lifetime; refresh preserves identity.
alter table private.mcp_event_subscriptions add column oauth_grant_id text references private.mcp_oauth_grants(id);
alter function public.mcp_event_dispatch(text,jsonb) rename to mcp_event_dispatch_before_oauth;
revoke all on function public.mcp_event_dispatch_before_oauth(text,jsonb) from public,anon,authenticated,service_role;
create function public.mcp_event_dispatch(action text,args jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; grant_id text; existing_grant text; authorized_grant private.mcp_oauth_grants;
begin
 if action in ('claim','read','save','remove') then
 delete from private.mcp_event_subscriptions s using private.mcp_oauth_grants g,private.agent_connections c,private.mcp_oauth_policy p
 where s.oauth_grant_id=g.id and c.id=g.connection_id and (not p.enabled or g.revoked_at is not null or g.expires_at<=now() or c.revoked_at is not null or c.expires_at<=now() or g.scopes is distinct from c.scopes or g.resource is distinct from p.resource or g.client_id is distinct from p.client_id);
 end if;
 if action in ('authorize','read','save','remove') then
 select r.grant_id into grant_id from private.mcp_oauth_records r where model='AccessToken' and key_hash=args->>'hash';
 if grant_id is not null then authorized_grant:=private.mcp_oauth_grant(grant_id);if action='save' then args:=jsonb_set(args,'{expires}',to_jsonb(least((args->>'expires')::timestamptz,authorized_grant.expires_at)));end if;end if;
 if args->>'id' is not null then perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(args->>'id',0));end if;
 select oauth_grant_id into existing_grant from private.mcp_event_subscriptions where id=args->>'id';
 if found and existing_grant is distinct from grant_id then raise exception 'Subscription belongs to another authorization' using errcode='42501';end if;
 end if;
 if action='delivery' then
 select s.oauth_grant_id into grant_id from private.mcp_event_subscriptions s join private.mcp_event_deliveries d on d.subscription_id=s.id where d.id=(args->>'id')::uuid;
 if grant_id is not null then
 begin perform private.mcp_oauth_grant(grant_id);exception when sqlstate '28000' then return null;end;
 end if;
 end if;
 result:=public.mcp_event_dispatch_before_oauth(action,args);
 if action='save' then update private.mcp_event_subscriptions set oauth_grant_id=grant_id where id=args->>'id';end if;
 return result;
end $$;
revoke all on function public.mcp_event_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_event_dispatch(text,jsonb) to service_role;
commit;
