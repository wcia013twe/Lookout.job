begin;

create sequence private.shared_job_revision;
create table private.shared_job_pool (
 id uuid primary key default gen_random_uuid(),
 canonical_url text not null unique,
 match_key text not null unique,
 facts jsonb not null,
 checked_at timestamptz not null,
 revision bigint not null default nextval('private.shared_job_revision')
);
create index shared_job_pool_revision on private.shared_job_pool(revision);
create table private.shared_job_subscriptions (
 user_id uuid not null references auth.users on delete cascade,
 profile_id text not null,
 enabled boolean not null,
 cursor bigint not null default 0,
 version integer not null,
 updated_at timestamptz not null default now(),
 primary key(user_id,profile_id)
);
create table private.shared_job_writes (
 job_id uuid not null references private.backend_jobs on delete cascade,
 event_key text not null,
 payload jsonb not null,
 response jsonb not null,
 primary key(job_id,event_key)
);
alter table private.shared_job_pool enable row level security;
alter table private.shared_job_subscriptions enable row level security;
alter table private.shared_job_writes enable row level security;
revoke all on private.shared_job_pool,private.shared_job_subscriptions,private.shared_job_writes from public,anon,authenticated;
revoke all on sequence private.shared_job_revision from public,anon,authenticated;
grant all on private.shared_job_pool,private.shared_job_subscriptions,private.shared_job_writes to service_role;
grant usage,select on sequence private.shared_job_revision to service_role;

create function private.write_shared_jobs(job private.backend_jobs,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare item jsonb;canonical text;matching text;existing private.shared_job_pool;old private.shared_job_writes;response jsonb;checked timestamptz;counted integer:=0;
begin
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['runId','listings','eventKey']<>'{}'
 or payload->>'runId' is distinct from job.search_run_id::text or job.search_run_id is null
 or coalesce(payload->>'eventKey','') not like 'job:'||job.id::text||':%'
 or length(payload->>'eventKey')>160 or octet_length(payload::text)>240000
 or jsonb_typeof(payload->'listings') is distinct from 'array' or jsonb_array_length(payload->'listings') not between 1 and 25 then
  raise exception 'Bounded verified shared facts required' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(110,711);
 select * into old from private.shared_job_writes where job_id=job.id and event_key=payload->>'eventKey';
 if found then
  if old.payload<>payload then raise exception 'Shared facts retry changed' using errcode='40001';end if;
  return old.response;
 end if;
 for item in select value from jsonb_array_elements(payload->'listings') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['url','company','title','location','checkedAt','liveness','employerPostedAt','description','employmentType']<>'{}'
  or not item ?& array['url','company','title','location','checkedAt','liveness','employerPostedAt','description']
  or coalesce(item->>'url','') !~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$' or length(item->>'url')>2048
  or jsonb_typeof(item->'company') is distinct from 'string' or length(trim(item->>'company')) not between 1 and 200
  or jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 500
  or jsonb_typeof(item->'description') not in ('string','null') or length(item->>'description')>60000
  or (item->>'liveness'='active' and coalesce(length(item->>'description'),0)=0)
  or (jsonb_typeof(item->'location') not in ('string','null')) or length(coalesce(item->>'location',''))>2000
  or coalesce(item->>'liveness','') not in ('active','expired','uncertain')
  or (item ? 'employmentType' and jsonb_typeof(item->'employmentType') not in ('string','null')) then
   raise exception 'Employer facts only' using errcode='22023';
  end if;
  checked:=(item->>'checkedAt')::timestamptz;
  if checked is null or checked>now()+interval '5 minutes' or checked<now()-interval '72 hours' then raise exception 'Recent verification required' using errcode='22023';end if;
  perform (item->>'employerPostedAt')::timestamptz;
  canonical:=regexp_replace(item->>'url','#.*$','');
  canonical:=regexp_replace(canonical,'([?&])(utm_[^=&#]+|gh_src|lever-source|ref|source)=[^&#]*','\1','g');
  canonical:=replace(replace(canonical,'?&','?'),'&&','&');canonical:=regexp_replace(canonical,'[?&]+$','');
  matching:=lower(regexp_replace(concat_ws('|',item->>'company',item->>'title',item->>'location'),'[^a-zA-Z0-9|]','','g'));
  select * into existing from private.shared_job_pool where canonical_url=canonical or match_key=matching order by (canonical_url=canonical) desc limit 1;
  if found then
   if checked>=(select max(checked_at) from private.shared_job_pool where canonical_url=canonical or match_key=matching) then
    delete from private.shared_job_pool where id<>existing.id and (canonical_url=canonical or match_key=matching);
    update private.shared_job_pool set canonical_url=canonical,match_key=matching,facts=item||jsonb_build_object('url',canonical),checked_at=checked,revision=nextval('private.shared_job_revision') where id=existing.id;
   end if;
  else
   insert into private.shared_job_pool(canonical_url,match_key,facts,checked_at) values(canonical,matching,item||jsonb_build_object('url',canonical),checked);
  end if;
  counted:=counted+1;
 end loop;
 response:=jsonb_build_object('saved',counted);
 insert into private.shared_job_writes values(job.id,payload->>'eventKey',payload,response);
 return response;
end $$;

alter function public.backend_worker(text,jsonb) rename to backend_worker_before_shared_pool;
alter function public.backend_worker_before_shared_pool(text,jsonb) set schema private;
create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare job private.backend_jobs;
begin
 if operation='dispatch' and payload->>'operation'='search.pool.save' then
  if payload-array['jobId','leaseToken','expectedVersion','operation','payload']<>'{}' then raise exception 'Invalid shared dispatch' using errcode='22023';end if;
  perform private.backend_worker_before_shared_pool('heartbeat',jsonb_build_object('jobId',payload->'jobId','leaseToken',payload->'leaseToken','expectedVersion',payload->'expectedVersion'));
  select * into job from private.backend_jobs where id=(payload->>'jobId')::uuid for update;
  perform private.backend_connection(job.user_id,job.connection_id,true);
  perform private.backend_input(job.user_id,job.kind,job.input);
  if job.kind<>'search_ats' then raise exception 'Search worker required' using errcode='42501';end if;
  return private.write_shared_jobs(job,payload->'payload');
 end if;
 return private.backend_worker_before_shared_pool(operation,payload);
end $$;

create function private.shared_jobs_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare subscription private.shared_job_subscriptions;old private.search_requests;response jsonb;profile text;lim integer;after_cursor bigint;through_cursor bigint;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>4000 then raise exception 'Invalid shared pool arguments' using errcode='22023';end if;
 profile:=payload->>'profileId';
 if jsonb_typeof(payload->'profileId') is distinct from 'string' or length(trim(profile))=0 then raise exception 'Profile ID required' using errcode='22023';end if;
 if not exists(select 1 from public.search_documents where user_id=owner_id and kind='profile' and id=profile and projection->>'active'='true') then raise exception 'Active owned profile required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 select * into subscription from private.shared_job_subscriptions where user_id=owner_id and profile_id=profile;
 if operation='search.pool.read' then
  if payload-array['profileId','afterCursor','limit']<>'{}' or coalesce(payload->>'afterCursor','0') !~ '^[0-9]{1,15}$' or coalesce(payload->>'limit','25') !~ '^[0-9]{1,3}$' then raise exception 'Bounded shared page required' using errcode='22023';end if;
  if subscription.enabled is distinct from true then raise exception 'Subscribe to the shared pool first' using errcode='42501';end if;
  lim:=coalesce((payload->>'limit')::integer,25);after_cursor:=coalesce((payload->>'afterCursor')::bigint,subscription.cursor);
  if lim not between 1 and 100 then raise exception 'Bounded shared page required' using errcode='22023';end if;
  select coalesce(max(revision),0) into through_cursor from private.shared_job_pool;
  if after_cursor>through_cursor then raise exception 'Shared cursor exceeds inventory' using errcode='22023';end if;
  with page as (select * from private.shared_job_pool where revision>after_cursor and revision<=through_cursor and checked_at>=now()-interval '72 hours' order by revision limit lim+1)
  select jsonb_build_object('jobs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'facts',facts) order by revision) from (select * from page order by revision limit lim) rows),'[]'::jsonb),
   'nextCursor',case when (select count(*) from page)>lim then (select max(revision) from (select revision from page order by revision limit lim) rows) else through_cursor end,
   'hasMore',(select count(*) from page)>lim,'subscription',to_jsonb(subscription)-'user_id',
   'coverage','Shared verified observations only; not an exhaustive source scan. Closed and uncertain updates are tombstones, not recommendations.','checkedWithinHours',72) into response;
  return response;
 end if;
 if operation<>'search.pool.subscribe' or payload-array['profileId','enabled','cursor','expectedVersion','eventKey']<>'{}'
 or jsonb_typeof(payload->'enabled') is distinct from 'boolean' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$'
 or coalesce(payload->>'eventKey','') !~ '^[a-zA-Z0-9_:.-]{1,160}$' or (payload ? 'cursor' and coalesce(payload->>'cursor','') !~ '^[0-9]{1,15}$') then raise exception 'Versioned shared subscription required' using errcode='22023';end if;
 select * into old from private.search_requests where user_id=owner_id and event_key=payload->>'eventKey';
 if found then
  if old.operation<>operation or old.payload<>payload then raise exception 'Retry payload changed' using errcode='40001';end if;
  return old.response;
 end if;
 if coalesce(subscription.version,0)<>(payload->>'expectedVersion')::integer then raise exception 'Shared subscription changed' using errcode='40001';end if;
 after_cursor:=coalesce((payload->>'cursor')::bigint,subscription.cursor,0);
 select coalesce(max(revision),0) into through_cursor from private.shared_job_pool;
 if after_cursor>through_cursor then raise exception 'Shared cursor exceeds inventory' using errcode='22023';end if;
 insert into private.shared_job_subscriptions(user_id,profile_id,enabled,cursor,version) values(owner_id,profile,(payload->>'enabled')::boolean,after_cursor,coalesce(subscription.version,0)+1)
 on conflict(user_id,profile_id) do update set enabled=excluded.enabled,cursor=excluded.cursor,version=excluded.version,updated_at=now() returning * into subscription;
 response:=to_jsonb(subscription)-'user_id';
 insert into private.search_requests(user_id,event_key,operation,payload,response) values(owner_id,payload->>'eventKey',operation,payload,response);
 return response;
end $$;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_shared_pool;
alter function public.agent_dispatch_before_shared_pool(text,text,jsonb) set schema private;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare connection private.agent_connections;response jsonb;
begin
 if operation='search.pool.save' then raise exception 'Shared facts require a leased worker' using errcode='42501';end if;
 if operation in ('search.pool.read','search.pool.subscribe') then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into connection from private.agent_connections where token_hash=credential_hash;
  if not 'workspace:read'=any(connection.scopes) or (operation='search.pool.subscribe' and not 'preferences:write'=any(connection.scopes)) then raise exception 'Shared pool scope required' using errcode='42501';end if;
  return private.shared_jobs_owned(connection.user_id,operation,payload);
 end if;
 response:=private.agent_dispatch_before_shared_pool(credential_hash,operation,payload);
 if operation='search.context' then
  select * into connection from private.agent_connections where token_hash=credential_hash;
  response:=response||jsonb_build_object('sharedPool',jsonb_build_object('agentOnly',true,'subscription',(select to_jsonb(subscription)-'user_id' from private.shared_job_subscriptions subscription where user_id=connection.user_id and profile_id=response->>'profileId')));
 end if;
 return response;
end $$;

do $install$
declare definition text;body text;original text;replacement text;
begin
 select pg_get_functiondef(p.oid),p.prosrc into definition,body
 from pg_proc p where p.oid='private.agent_dispatch_core(text,text,jsonb)'::regprocedure;
 original:=$old$select o.description from public.search_observations o
   join public.search_listings l on l.id=o.listing_id and l.user_id=o.user_id
   where o.user_id=c.user_id and l.canonical_url=job->>'canonicalUrl'
   order by o.checked_at desc,o.created_at desc,o.id desc limit 1
 ),''$old$;
 replacement:=$new$select o.description from public.search_observations o
   join public.search_listings l on l.id=o.listing_id and l.user_id=o.user_id
   where o.user_id=c.user_id and l.canonical_url=job->>'canonicalUrl'
   order by o.checked_at desc,o.created_at desc,o.id desc limit 1
 ),(select facts->>'description' from private.shared_job_pool
   where canonical_url=job->>'canonicalUrl' and facts->>'liveness'='active' and checked_at>=now()-interval '72 hours'),''$new$;
 if position(original in body)=0 then raise exception 'Shared publication JD insertion hook not found';end if;
 execute replace(definition,body,replace(body,original,replacement));
end $install$;

revoke all on function private.write_shared_jobs(private.backend_jobs,jsonb),private.shared_jobs_owned(uuid,text,jsonb),private.agent_dispatch_before_shared_pool(text,text,jsonb),private.backend_worker_before_shared_pool(text,jsonb),public.agent_dispatch(text,text,jsonb),public.backend_worker(text,jsonb) from public,anon,authenticated;
grant execute on function private.shared_jobs_owned(uuid,text,jsonb),public.agent_dispatch(text,text,jsonb),public.backend_worker(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
