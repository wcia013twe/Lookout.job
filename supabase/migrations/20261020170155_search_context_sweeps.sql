begin;
-- Canonical context documents, immutable revisions, and private search memory.
create table public.search_documents (
 user_id uuid not null references auth.users on delete cascade, kind text not null check(kind in ('profile','rules','portals')),
 id text not null check(id ~ '^[a-zA-Z0-9_-]{1,80}$'), version integer not null check(version>0),
 content text not null check(length(content)<=60000), projection jsonb not null,
 updated_at timestamptz not null default now(), primary key(user_id,kind,id)
);
create table public.search_document_revisions (
 user_id uuid not null references auth.users on delete cascade, kind text not null,id text not null,version integer not null,
 content text not null,projection jsonb not null,created_at timestamptz not null default now(),primary key(user_id,kind,id,version)
);
create table public.search_runs (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 profile_id text not null,context_snapshot jsonb not null,mode text not null check(mode in ('fresh','backlog')),days integer not null check(days between 1 and 365),
 state text not null default 'active' check(state in ('active','completed','partial','cancelled')),version integer not null default 0,
 summary text not null default '',created_at timestamptz not null default now(),finished_at timestamptz,unique(user_id,id)
);
create table public.search_source_attempts (
 user_id uuid not null,run_id uuid not null,source_id text not null,source jsonb not null,
 state text not null default 'pending' check(state in ('pending','active','completed','blocked')),version integer not null default 0,
 checkpoint jsonb not null default '{}',counts jsonb not null default '{}',coverage text not null default 'unknown',blocker text not null default '',
 updated_at timestamptz not null default now(),primary key(user_id,run_id,source_id),foreign key(user_id,run_id) references public.search_runs(user_id,id) on delete cascade
);
create table public.search_listings (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 identity text not null,canonical_url text not null,company text not null,title text not null,location text,
 requisition_id text,employment_type text,match_key text not null,
 first_seen timestamptz not null default now(),last_seen timestamptz not null default now(),unique(user_id,identity),unique(user_id,id)
);
create index search_listing_match on public.search_listings(user_id,match_key);
create table public.search_observations (
 id uuid primary key default gen_random_uuid(),user_id uuid not null,listing_id uuid not null,run_id uuid not null,source_id text not null,
 checked_at timestamptz not null,liveness text not null check(liveness in ('active','expired','uncertain')),
 employer_posted_at timestamptz,source_list_age_days integer check(source_list_age_days>=0),evidence text not null,description text not null,
 observed_url text not null,created_at timestamptz not null default now(),
 foreign key(user_id,listing_id) references public.search_listings(user_id,id) on delete cascade,
 foreign key(user_id,run_id,source_id) references public.search_source_attempts(user_id,run_id,source_id) on delete cascade
);
create index search_observation_listing on public.search_observations(user_id,listing_id,created_at desc);
create index search_observation_run on public.search_observations(user_id,run_id,listing_id);
create table public.search_screenings (
 user_id uuid not null,listing_id uuid not null,version integer not null,run_id uuid not null,
 decision text not null check(decision in ('review-needed','eligible','ineligible')),checks jsonb not null,explanation text not null,
 created_at timestamptz not null default now(),primary key(user_id,listing_id,version),
 foreign key(user_id,listing_id) references public.search_listings(user_id,id) on delete cascade,
 foreign key(user_id,run_id) references public.search_runs(user_id,id) on delete cascade
);
create table private.search_requests (
 user_id uuid not null references auth.users on delete cascade,event_key text not null,operation text not null,payload jsonb not null,response jsonb not null,
 created_at timestamptz not null default now(),primary key(user_id,event_key)
);
alter table private.search_requests enable row level security;
revoke all on private.search_requests from public,anon,authenticated;
grant all on private.search_requests to service_role;
do $$ declare t text;begin
 foreach t in array array['search_documents','search_document_revisions','search_runs','search_source_attempts','search_listings','search_observations','search_screenings'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy owner_read on public.%I for select to authenticated using(user_id=(select auth.uid()))',t);
 end loop;
end $$;
-- Raw browser preference writes cannot bypass the canonical context boundary.
create function private.guard_search_projections() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='DELETE' then
   if exists(select 1 from public.search_documents where user_id=old.user_id) then raise exception 'Use canonical context operations' using errcode='42501';end if;
   return old;
  elsif tg_op='INSERT' then
   if new.search ?| array['profiles','targets','targetsVersion'] then raise exception 'Use canonical context operations' using errcode='42501';end if;
  elsif (new.search->'profiles') is distinct from (old.search->'profiles') or (new.search->'targets') is distinct from (old.search->'targets') or (new.search->'targetsVersion') is distinct from (old.search->'targetsVersion') then
   raise exception 'Use canonical context operations' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_search_projections() from public,anon,authenticated;
create trigger canonical_search_projection before insert or update or delete on public.preferences for each row execute function private.guard_search_projections();
create trigger search_document_context after insert or update or delete on public.search_documents for each row execute function private.bump_agent_settings_version();

-- Retain the existing profile/target validation and projection writers privately.
alter function private.save_search_profile_for_owner(uuid,integer,jsonb) rename to search_profile_projection;
alter function private.save_search_targets_for_owner(uuid,integer,jsonb) rename to search_targets_projection;
create function private.write_search_document(owner_id uuid,doc_kind text,doc_id text,expected_version integer,doc_content text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare previous public.search_documents; p jsonb;body text;header text;profile jsonb;targets jsonb;result public.search_documents;x jsonb;v integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 if doc_kind not in ('profile','rules','portals') or doc_id is null or doc_id !~ '^[a-zA-Z0-9_-]{1,80}$' or (doc_kind<>'profile' and doc_id<>'shared') or expected_version is null or expected_version<0 or doc_content is null or length(doc_content)>60000 then raise exception 'Invalid document' using errcode='22023';end if;
 select * into previous from public.search_documents where user_id=owner_id and kind=doc_kind and id=doc_id for update;
 if coalesce(previous.version,0)<>expected_version then raise exception 'Document changed; reload' using errcode='40001';end if;
 if doc_kind='profile' then
  if left(doc_content,4)<>E'---\n' or position(E'\n---\n' in substring(doc_content from 5))=0 then raise exception 'Canonical YAML frontmatter required' using errcode='22023';end if;
  header:=split_part(substring(doc_content from 5),E'\n---\n',1);
  body:=substring(doc_content from length(header)+10);
  p:=header::jsonb;
  if p->>'id' is distinct from doc_id or exists(select 1 from jsonb_object_keys(p) k where k not in ('id','name','active','filters','priorities')) then raise exception 'Profile ID/fields mismatch' using errcode='22023';end if;
  p:=p||jsonb_build_object('instructions',body);
  select coalesce((s->>'version')::integer,0) into v from public.preferences f,jsonb_array_elements(coalesce(f.search->'profiles','[]')) s where f.user_id=owner_id and s->>'id'=doc_id;
  profile:=private.search_profile_projection(owner_id,coalesce(v,0),p);
 elsif doc_kind='portals' then
  p:=doc_content::jsonb;
  if jsonb_typeof(p) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p) k where k not in ('tracked_companies','search_queries','title_filter','location_filter')) or jsonb_typeof(p->'tracked_companies') is distinct from 'array' or jsonb_array_length(p->'tracked_companies')>100 or jsonb_typeof(p->'search_queries') is distinct from 'array' or jsonb_array_length(p->'search_queries')>100 then raise exception 'Invalid portals' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p->'search_queries') q where jsonb_typeof(q)<>'string' or length(trim(q#>>'{}')) not between 1 and 2000) then raise exception 'Invalid query' using errcode='22023';end if;
  for x in select value from jsonb_array_elements(p->'tracked_companies') loop
   if jsonb_typeof(x->'enabled') is distinct from 'boolean' or exists(select 1 from jsonb_object_keys(x) k where k not in ('id','name','kind','careers_url','enabled','provider','api','keywords')) then raise exception 'Invalid source fields' using errcode='22023';end if;
   if x ? 'provider' and (jsonb_typeof(x->'provider')<>'string' or length(x->>'provider')>100) or x ? 'api' and (jsonb_typeof(x->'api')<>'string' or length(x->>'api')>2048 or x->>'api' !~ '^https://') or x ? 'keywords' and (jsonb_typeof(x->'keywords')<>'array' or jsonb_array_length(x->'keywords')>20) then raise exception 'Invalid provider hints' using errcode='22023';end if;
  end loop;
  if p ? 'title_filter' and (jsonb_typeof(p->'title_filter')<>'object' or exists(select 1 from jsonb_object_keys(p->'title_filter') k where k not in ('positive','negative')) or exists(select 1 from jsonb_each(p->'title_filter') e where jsonb_typeof(e.value)<>'array')) then raise exception 'Invalid title filters' using errcode='22023';end if;
  if p ? 'location_filter' and (jsonb_typeof(p->'location_filter')<>'object' or exists(select 1 from jsonb_object_keys(p->'location_filter') k where k not in ('allow','strict')) or p->'location_filter' ? 'allow' and jsonb_typeof(p->'location_filter'->'allow')<>'array' or p->'location_filter' ? 'strict' and jsonb_typeof(p->'location_filter'->'strict')<>'boolean') then raise exception 'Invalid locations' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(coalesce(p->'title_filter','{}')) e cross join lateral jsonb_array_elements(e.value) item where jsonb_typeof(item)<>'string' or length(item#>>'{}')>200) or exists(select 1 from jsonb_array_elements(coalesce(p#>'{location_filter,allow}','[]')) item where jsonb_typeof(item)<>'string' or length(item#>>'{}')>200) then raise exception 'Filters require bounded text arrays' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',s->>'id','name',s->>'name','kind',s->>'kind','address',s->>'careers_url')),'[]') into targets from jsonb_array_elements(p->'tracked_companies') s;
  select coalesce((search->>'targetsVersion')::integer,0) into v from public.preferences where user_id=owner_id;
  perform private.search_targets_projection(owner_id,coalesce(v,0),targets);
 else p:='{}';end if;
 insert into public.search_documents(user_id,kind,id,version,content,projection) values(owner_id,doc_kind,doc_id,expected_version+1,doc_content,p)
 on conflict(user_id,kind,id) do update set version=excluded.version,content=excluded.content,projection=excluded.projection,updated_at=now() returning * into result;
 insert into public.search_document_revisions(user_id,kind,id,version,content,projection) values(owner_id,doc_kind,doc_id,result.version,doc_content,p);
 return to_jsonb(result);
end $$;
revoke all on function private.write_search_document(uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function private.write_search_document(uuid,text,text,integer,text) to service_role;

-- Legacy controls now write canonical documents. Preserve narrative and portal extras.
create function private.save_search_profile_for_owner(owner_id uuid,expected_version integer,next_profile jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.search_documents;v integer;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 select * into d from public.search_documents where user_id=owner_id and kind='profile' and id=next_profile->>'id';
 select coalesce((p->>'version')::integer,0) into v from public.preferences f,jsonb_array_elements(coalesce(f.search->'profiles','[]')) p where f.user_id=owner_id and p->>'id'=next_profile->>'id';
 if expected_version is null or coalesce(v,0)<>expected_version then raise exception 'Profile changed' using errcode='40001';end if;
 result:=private.write_search_document(owner_id,'profile',next_profile->>'id',coalesce(d.version,0),E'---\n'||(next_profile-'instructions')::text||E'\n---\n'||coalesce(next_profile->>'instructions',''));
 return result->'projection'||jsonb_build_object('version',expected_version+1);
end $$;
create function private.save_search_targets_for_owner(owner_id uuid,expected_version integer,next_targets jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.search_documents;p jsonb;items jsonb;v integer;result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 select coalesce((search->>'targetsVersion')::integer,0) into v from public.preferences where user_id=owner_id;
 if expected_version is null or coalesce(v,0)<>expected_version then raise exception 'Targets changed' using errcode='40001';end if;
 -- Existing validator rejects duplicate/invalid targets before a canonical save.
 perform private.search_targets_projection(owner_id,expected_version,next_targets);
 select * into d from public.search_documents where user_id=owner_id and kind='portals' and id='shared';
 p:=coalesce(d.projection,'{"search_queries":[],"title_filter":{"positive":[],"negative":[]},"location_filter":{"allow":[],"strict":false}}');
 select coalesce(jsonb_agg(coalesce((select s from jsonb_array_elements(coalesce(p->'tracked_companies','[]')) s where s->>'id'=t->>'id'),'{}')||jsonb_build_object('id',t->>'id','name',t->>'name','kind',t->>'kind','careers_url',t->>'address','enabled',coalesce((select s->'enabled' from jsonb_array_elements(coalesce(p->'tracked_companies','[]')) s where s->>'id'=t->>'id'),'true'::jsonb))),'[]') into items from jsonb_array_elements(next_targets) t;
 p:=p||jsonb_build_object('tracked_companies',items);
 result:=private.write_search_document(owner_id,'portals','shared',coalesce(d.version,0),p::text);
 -- write_search_document calls the projection writer; preserve legacy one-step version.
 update public.preferences set search=jsonb_set(search,'{targetsVersion}',to_jsonb(expected_version+1)) where user_id=owner_id;
 return jsonb_build_object('targets',next_targets,'version',expected_version+1);
end $$;
revoke all on function private.save_search_profile_for_owner(uuid,integer,jsonb),private.save_search_targets_for_owner(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.save_search_profile_for_owner(uuid,integer,jsonb),private.save_search_targets_for_owner(uuid,integer,jsonb) to service_role;

-- Convert only existing account settings. No local user files are read.
do $$ declare f public.preferences;p jsonb;items jsonb;hints jsonb;v integer;content text;begin
 for f in select * from public.preferences loop
 for p in select value from jsonb_array_elements(coalesce(f.search->'profiles','[]')) loop
 v:=greatest(coalesce((p->>'version')::integer,1),1);
 content:=E'---\n'||(p-array['version','instructions','prompt'])::text||E'\n---\n'||coalesce(p->>'instructions',p->>'prompt','');
 insert into public.search_documents(user_id,kind,id,version,content,projection) values(f.user_id,'profile',p->>'id',v,content,p-array['version','prompt']);
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','name',t->>'name','kind',t->>'kind','careers_url',t->>'address','enabled',true)||coalesce((select r.result->'options'||jsonb_build_object('provider',r.result->>'provider') from public.career_toolkit_results r where r.user_id=f.user_id and r.kind='source_config' and r.result->>'targetId'=t->>'id' order by r.created_at desc,r.id desc limit 1),'{}')),'[]') into items from jsonb_array_elements(coalesce(f.search->'targets','[]')) t;
 p:=jsonb_build_object('tracked_companies',items,'search_queries','[]'::jsonb,'title_filter',jsonb_build_object('positive','[]'::jsonb,'negative','[]'::jsonb),'location_filter',jsonb_build_object('allow','[]'::jsonb,'strict',false));
 insert into public.search_documents(user_id,kind,id,version,content,projection) values(f.user_id,'portals','shared',1,p::text,p);
 insert into public.search_documents(user_id,kind,id,version,content,projection) values(f.user_id,'rules','shared',1,'','{}');
 end loop;
 insert into public.search_document_revisions(user_id,kind,id,version,content,projection) select z.user_id,z.kind,z.id,z.version,z.content,z.projection from public.search_documents z;
end $$;

create function private.search_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare response jsonb;old private.search_requests;r public.search_runs;d public.search_documents;s public.search_source_attempts;l public.search_listings;o public.search_observations;
 docs jsonb;snapshot jsonb;selected_profile text;p jsonb;x jsonb;a jsonb;list jsonb:='[]';v integer;identity_key text;canonical text;match_key text;source_id text;mode text;days integer;checks jsonb;latest public.search_screenings;t private.agent_tasks;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>240000 or payload ?| array['userId','user_id','owner_id','projection'] then raise exception 'Invalid payload' using errcode='22023';end if;
 -- Serialize writes, retries, and context snapshots per account.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 if operation not in ('search.context','search.run.read','search.discoveries.read','search.document.history') then
  if coalesce(payload->>'eventKey','') !~ '^[a-zA-Z0-9_:.-]{1,160}$' then raise exception 'Stable eventKey required' using errcode='22023';end if;
  select * into old from private.search_requests where user_id=owner_id and event_key=payload->>'eventKey';
  if found then
   if old.operation<>operation or old.payload<>payload then raise exception 'Retry payload changed' using errcode='40001';end if;
   return old.response;
  end if;
 end if;
 -- Only selected context is loaded; history and write operations do not need it.
 if operation in ('search.context','search.run.start') or operation='search.run.read' and payload ? 'runId' then
  if operation='search.run.read' then
   select profile_id into selected_profile from public.search_runs where user_id=owner_id and id=(payload->>'runId')::uuid;
  else
   selected_profile:=coalesce(payload->>'profileId',(select f.id from public.search_documents f where f.user_id=owner_id and f.kind='profile' and (f.projection->>'active')::boolean order by f.id limit 1));
  end if;
  select coalesce(jsonb_agg(to_jsonb(f) order by f.kind,f.id),'[]') into docs from public.search_documents f where user_id=owner_id and (kind in ('rules','portals') or kind='profile' and id=selected_profile);
  snapshot:=jsonb_build_object('documents',docs,'personalVersion',coalesce((select version from private.agent_settings_versions where user_id=owner_id),1),'profile',(select to_jsonb(f)-'updated_at' from public.profiles f where user_id=owner_id),'tierLists',coalesce((select tier_lists from public.preferences where user_id=owner_id),'[]'));
 end if;
 if operation='search.context' then
  return snapshot||jsonb_build_object('profileId',selected_profile,
   'profiles',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',projection->>'name','active',projection->'active','version',version) order by id) from public.search_documents where user_id=owner_id and kind='profile'),'[]'));
 elsif operation='search.document.history' then
  return coalesce((select jsonb_agg(to_jsonb(f) order by f.version desc) from (select * from public.search_document_revisions where user_id=owner_id and kind=payload->>'kind' and id=payload->>'id' order by version desc limit 50 offset greatest(coalesce((payload->>'offset')::integer,0),0)) f),'[]');
 elsif operation='search.document.save' then
  response:=private.write_search_document(owner_id,payload->>'kind',payload->>'id',(payload->>'expectedVersion')::integer,payload->>'content');
 elsif operation='search.run.read' then
  if not payload ? 'runId' then return coalesce((select jsonb_agg(to_jsonb(f)-'context_snapshot' order by (state='active') desc,created_at desc,id desc) from (select * from public.search_runs where user_id=owner_id order by (state='active') desc,created_at desc,id desc limit 50) f),'[]');end if;
  select * into r from public.search_runs where user_id=owner_id and id=(payload->>'runId')::uuid;
  if not found then raise exception 'Owned run required' using errcode='P0002';end if;
  return to_jsonb(r)||jsonb_build_object('sources',coalesce((select jsonb_agg(to_jsonb(f) order by source_id) from public.search_source_attempts f where user_id=owner_id and f.run_id=r.id),'[]'),'contextChanged',(r.context_snapshot-'personalVersion')<>(snapshot-'personalVersion'));
 elsif operation='search.run.start' then
  select * into d from public.search_documents where user_id=owner_id and kind='profile' and id=payload->>'profileId';
  if not found then raise exception 'Create a search profile first' using errcode='P0002';end if;
  if exists(select 1 from public.search_runs where user_id=owner_id and profile_id=d.id and state='active') then raise exception 'Resume the active sweep for this profile' using errcode='40001';end if;
  select projection into p from public.search_documents where user_id=owner_id and kind='portals' and id='shared';
  if p is null or not exists(select 1 from jsonb_array_elements(p->'tracked_companies') q where (q->>'enabled')::boolean) and jsonb_array_length(p->'search_queries')=0 then raise exception 'Configure portals or queries first' using errcode='22023';end if;
  mode:=coalesce(payload->>'mode','fresh');days:=coalesce((payload->>'days')::integer,case when mode='backlog' then 30 else 3 end);
  insert into public.search_runs(user_id,profile_id,context_snapshot,mode,days) values(owner_id,d.id,snapshot,mode,days) returning * into r;
  for x in select value from jsonb_array_elements(p->'tracked_companies') loop
   if (x->>'enabled')::boolean then insert into public.search_source_attempts(user_id,run_id,source_id,source) values(owner_id,r.id,'portal:'||(x->>'id'),x);end if;
  end loop;
  for x,v in select value,ordinality::integer from jsonb_array_elements(p->'search_queries') with ordinality loop
   insert into public.search_source_attempts(user_id,run_id,source_id,source) values(owner_id,r.id,'query:'||v,jsonb_build_object('query',x));
  end loop;
  response:=private.search_owned(owner_id,'search.run.read',jsonb_build_object('runId',r.id));
 elsif operation='search.request' then
  if not exists(select 1 from public.search_documents where user_id=owner_id and kind='profile' and id=payload->>'profileId') then raise exception 'Owned profile required' using errcode='P0002';end if;
  if exists(select 1 from private.agent_tasks where user_id=owner_id and kind='discover' and state in ('queued','claimed','running','uncertain')) then raise exception 'Discovery already queued or unresolved' using errcode='40001';end if;
  if (select count(*) from private.agent_tasks where user_id=owner_id and kind='discover' and created_at>now()-interval '1 hour')>=3 then raise exception 'Discovery request limit reached' using errcode='22023';end if;
  insert into private.agent_tasks(user_id,kind,target,onboarding_revision,event_key) values(owner_id,'discover',jsonb_build_object('searchProfileId',payload->>'profileId','mode',coalesce(payload->>'mode','fresh')),coalesce((select revision from private.onboarding_sessions where user_id=owner_id),0),'search:'||(payload->>'eventKey')) returning * into t;
  response:=to_jsonb(t)-'claim_token'-'claimed_by';
 elsif operation='search.discoveries.read' then
  if payload ? 'runId' and not exists(select 1 from public.search_runs where user_id=owner_id and id=(payload->>'runId')::uuid) then raise exception 'Owned run required' using errcode='P0002';end if;
  select coalesce(jsonb_agg(item order by item->>'id'),'[]') into list from (
   select to_jsonb(f)||jsonb_build_object('screeningVersion',coalesce((select max(z.version) from public.search_screenings z where z.user_id=owner_id and z.listing_id=f.id),0),
    'screening',(select to_jsonb(z) from public.search_screenings z where z.user_id=owner_id and z.listing_id=f.id and (not payload ? 'runId' or z.run_id=(payload->>'runId')::uuid) order by version desc limit 1),
    'observation',(select to_jsonb(z) from public.search_observations z where z.user_id=owner_id and z.listing_id=f.id and (not payload ? 'runId' or z.run_id=(payload->>'runId')::uuid) order by checked_at desc,created_at desc,id desc limit 1),
    'screenings',coalesce((select jsonb_agg(to_jsonb(z) order by z.version desc) from public.search_screenings z where z.user_id=owner_id and z.listing_id=f.id and (not payload ? 'runId' or z.run_id=(payload->>'runId')::uuid)),'[]'),
    'observationCount',(select count(*) from public.search_observations z where z.user_id=owner_id and z.listing_id=f.id and (not payload ? 'runId' or z.run_id=(payload->>'runId')::uuid)),
    'possibleDuplicates',coalesce((select jsonb_agg(z.id) from public.search_listings z where z.user_id=owner_id and z.id<>f.id and z.match_key=f.match_key),'[]'),
    'jobId',(select j.id from public.jobs j where j.canonical_url=f.canonical_url),
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'jobId',a.job_id)) from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id and j.canonical_url=f.canonical_url),'[]')) item
   from public.search_listings f where f.user_id=owner_id
    and (not payload ? 'runId' or exists(select 1 from public.search_observations z where z.user_id=owner_id and z.listing_id=f.id and z.run_id=(payload->>'runId')::uuid))
    and (not payload ? 'decision' or coalesce((select decision from public.search_screenings z where z.user_id=owner_id and z.listing_id=f.id and (not payload ? 'runId' or z.run_id=(payload->>'runId')::uuid) order by version desc limit 1),'review-needed')=payload->>'decision')
   order by f.id limit least(greatest(coalesce((payload->>'limit')::integer,50),1),100) offset greatest(coalesce((payload->>'offset')::integer,0),0)
  ) q;
  return jsonb_build_object('listings',list,'offset',coalesce((payload->>'offset')::integer,0),'nextOffset',case when jsonb_array_length(list)=least(greatest(coalesce((payload->>'limit')::integer,50),1),100) then coalesce((payload->>'offset')::integer,0)+jsonb_array_length(list) else null end);
 elsif operation='search.screening.save' then
  select * into l from public.search_listings where user_id=owner_id and id=(payload->>'listingId')::uuid for update;
  if not found then raise exception 'Owned listing required' using errcode='P0002';end if;
  select * into latest from public.search_screenings where user_id=owner_id and listing_id=l.id order by version desc limit 1;
  if coalesce(latest.version,0) is distinct from (payload->>'expectedVersion')::integer then raise exception 'Screening changed' using errcode='40001';end if;
  if not exists(select 1 from public.search_runs where user_id=owner_id and id=(payload->>'runId')::uuid) then raise exception 'Owned screening run required' using errcode='P0002';end if;
  checks:=payload->'checks';
  if jsonb_typeof(checks) is distinct from 'array' or jsonb_array_length(checks)>100 or coalesce(payload->>'decision','') not in ('review-needed','eligible','ineligible') or length(trim(coalesce(payload->>'explanation',''))) not between 1 and 5000 then raise exception 'Invalid screening' using errcode='22023';end if;
  for x in select value from jsonb_array_elements(checks) loop
   if jsonb_typeof(x) is distinct from 'object' or length(trim(coalesce(x->>'requirement',''))) not between 1 and 100 or coalesce(x->>'status','') not in ('met','unmet','unknown','not-applicable') or length(trim(coalesce(x->>'evidence',''))) not between 1 and 3000 or exists(select 1 from jsonb_object_keys(x) k where k not in ('requirement','status','evidence')) then raise exception 'Requirement evidence required' using errcode='22023';end if;
  end loop;
  if (select count(distinct q->>'requirement') from jsonb_array_elements(checks) q)<>jsonb_array_length(checks) then raise exception 'Duplicate checks' using errcode='22023';end if;
  select * into o from public.search_observations where user_id=owner_id and listing_id=l.id and run_id=(payload->>'runId')::uuid order by checked_at desc,created_at desc,id desc limit 1;
  if not found then raise exception 'Observed listing in this run required' using errcode='P0002';end if;
  if payload->>'decision'='eligible' and (o.liveness<>'active' or o.checked_at<now()-interval '24 hours' or nullif(trim(l.location),'') is null or nullif(trim(o.description),'') is null or exists(select 1 from jsonb_array_elements(checks) q where q->>'status' in ('unknown','unmet')) or not checks @> '[{"requirement":"experience"}]' or not checks @> '[{"requirement":"graduation"}]' or not checks @> '[{"requirement":"availability"}]' or not checks @> '[{"requirement":"location"}]' or not checks @> '[{"requirement":"authorization"}]' or not checks @> '[{"requirement":"prior-application"}]' or not checks @> '[{"requirement":"company-limits"}]') then raise exception 'Eligible needs fresh active evidence, location, JD and resolved eligibility checks' using errcode='22023';end if;
  insert into public.search_screenings(user_id,listing_id,version,run_id,decision,checks,explanation) values(owner_id,l.id,coalesce(latest.version,0)+1,o.run_id,payload->>'decision',checks,payload->>'explanation') returning to_jsonb(search_screenings.*) into response;
 else
  select * into r from public.search_runs where user_id=owner_id and id=(payload->>'runId')::uuid for update;
  if not found then raise exception 'Owned run required' using errcode='P0002';end if;
  if r.state<>'active' then raise exception 'Run is closed' using errcode='40001';end if;
  if operation='search.progress' then
   select * into s from public.search_source_attempts where user_id=owner_id and search_source_attempts.run_id=r.id and search_source_attempts.source_id=payload->>'sourceId' for update;
   if not found then raise exception 'Source not in run' using errcode='P0002';end if;
   if s.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Source changed' using errcode='40001';end if;
   if payload->>'state' not in ('active','completed','blocked') or jsonb_typeof(payload->'checkpoint') is distinct from 'object' or jsonb_typeof(payload->'counts') is distinct from 'object' or payload->>'coverage' not in ('unknown','exhaustive','truncated','inaccessible') or length(coalesce(payload->>'blocker',''))>3000 or exists(select 1 from jsonb_each(payload->'counts') q where jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]{1,9}$') then raise exception 'Invalid source progress' using errcode='22023';end if;
   update public.search_source_attempts set state=payload->>'state',version=version+1,checkpoint=payload->'checkpoint',counts=payload->'counts',coverage=payload->>'coverage',blocker=coalesce(payload->>'blocker',''),updated_at=now() where user_id=owner_id and search_source_attempts.run_id=r.id and search_source_attempts.source_id=s.source_id returning to_jsonb(search_source_attempts.*) into response;
   update public.search_runs set version=version+1 where id=r.id;
  elsif operation='search.discoveries.save' then
   if jsonb_typeof(payload->'listings') is distinct from 'array' or jsonb_array_length(payload->'listings') not between 1 and 25 then raise exception 'Save 1–25 discoveries' using errcode='22023';end if;
   for x in select value from jsonb_array_elements(payload->'listings') loop
    if exists(select 1 from jsonb_object_keys(x) k where k not in ('sourceId','url','company','title','location','checkedAt','liveness','evidence','employerPostedAt','sourceListAgeDays','description','atsIdentity','requisitionId','employmentType')) or x->>'url' !~ '^https://[^[:space:]/]+[^[:space:]]*$' or length(x->>'url')>2048 or length(trim(coalesce(x->>'company',''))) not between 1 and 200 or length(trim(coalesce(x->>'title',''))) not between 1 and 500 or x->>'liveness' not in ('active','expired','uncertain') or length(trim(coalesce(x->>'evidence',''))) not between 1 and 5000 or length(coalesce(x->>'description',''))>60000 or not x ?& array['url','location','checkedAt','employerPostedAt','sourceListAgeDays','description'] or length(coalesce(x->>'location',''))>500 or (x->>'checkedAt')::timestamptz>now()+interval '5 minutes' or (x->>'checkedAt')::timestamptz is null then raise exception 'Invalid observed listing' using errcode='22023';end if;
    source_id:=x->>'sourceId';
    if not exists(select 1 from public.search_source_attempts z where z.user_id=owner_id and z.run_id=r.id and z.source_id=source_id) then raise exception 'Source not in run' using errcode='P0002';end if;
    canonical:=regexp_replace(x->>'url','#.*$','');
    canonical:=regexp_replace(canonical,'([?&])(utm_[^=&#]+|gh_src|lever-source|ref|source)=[^&#]*','\1','g');
    canonical:=replace(replace(canonical,'?&','?'),'&&','&');canonical:=regexp_replace(canonical,'[?&]+$','');
    identity_key:=case when nullif(trim(x->>'atsIdentity'),'') is not null then 'ats:'||(x->>'atsIdentity') else 'url:'||canonical end;
    if length(identity_key)>2200 then raise exception 'Identity too long' using errcode='22023';end if;
    match_key:=lower(regexp_replace(concat_ws('|',x->>'company',x->>'title',x->>'location'),'[^a-zA-Z0-9|]','','g'));
    select * into l from public.search_listings where user_id=owner_id and (identity=identity_key or canonical_url=canonical) order by first_seen,id limit 1 for update;
    if found and l.requisition_id is not null and x->>'requisitionId' is not null and l.requisition_id<>x->>'requisitionId' then
     identity_key:=identity_key||':req:'||(x->>'requisitionId');
     select * into l from public.search_listings where user_id=owner_id and identity=identity_key for update;
    end if;
    if not found then
     insert into public.search_listings(user_id,identity,canonical_url,company,title,location,requisition_id,employment_type,match_key) values(owner_id,identity_key,canonical,x->>'company',x->>'title',x->>'location',x->>'requisitionId',x->>'employmentType',match_key) returning * into l;
    else
     update public.search_listings set last_seen=now(),location=coalesce(x->>'location',location),requisition_id=coalesce(x->>'requisitionId',requisition_id) where id=l.id returning * into l;
    end if;
    insert into public.search_observations(user_id,listing_id,run_id,source_id,checked_at,liveness,employer_posted_at,source_list_age_days,evidence,description,observed_url) values(owner_id,l.id,r.id,source_id,(x->>'checkedAt')::timestamptz,x->>'liveness',(x->>'employerPostedAt')::timestamptz,(x->>'sourceListAgeDays')::integer,x->>'evidence',coalesce(x->>'description',''),x->>'url') returning * into o;
    list:=list||jsonb_build_array(jsonb_build_object('listingId',l.id,'observationId',o.id,'url',canonical));
   end loop;
   update public.search_runs set version=version+1 where id=r.id;
   response:=jsonb_build_object('saved',list);
  elsif operation='search.run.finish' then
   if r.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Run changed; reload' using errcode='40001';end if;
   if payload->>'state' not in ('completed','partial','cancelled') or length(trim(coalesce(payload->>'summary',''))) not between 1 and 5000 then raise exception 'Outcome summary required' using errcode='22023';end if;
   if payload->>'state'='completed' and exists(select 1 from public.search_source_attempts z where z.user_id=owner_id and z.run_id=r.id and (state<>'completed' or coverage<>'exhaustive')) then raise exception 'Incomplete coverage; finish partial' using errcode='22023';end if;
   update public.search_runs set state=payload->>'state',summary=payload->>'summary',version=version+1,finished_at=now() where id=r.id returning to_jsonb(search_runs.*) into response;
  else raise exception 'Unknown search operation' using errcode='22023';end if;
 end if;
 insert into private.search_requests(user_id,event_key,operation,payload,response) values(owner_id,payload->>'eventKey',operation,payload,response);
 return response;
end $$;
revoke all on function private.search_owned(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.search_owned(uuid,text,jsonb) to service_role;
-- UI can configure documents, read state, and request work. Execution writes stay agent-scoped.
create function public.search_action(operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if operation not in ('search.context','search.document.save','search.document.history','search.run.read','search.discoveries.read','search.request') then raise exception 'Agent execution operation' using errcode='42501';end if;
 return private.search_owned(auth.uid(),operation,payload);
end $$;
revoke all on function public.search_action(text,jsonb) from public,anon;
grant execute on function public.search_action(text,jsonb) to authenticated;
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to search_previous;
revoke all on function private.search_previous(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; d public.search_documents; response jsonb; already_recorded boolean; portals jsonb;
begin
 if operation not like 'search.%' and not (operation='toolkit.record' and payload->>'kind'='source_config') then return private.search_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
 -- Reuse the existing source_config operation for one atomic, replayable write.
 if operation='toolkit.record' then
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,71));
  select exists(select 1 from public.career_toolkit_results where user_id=c.user_id and event_key=payload->>'eventKey') into already_recorded;
  response:=private.search_previous(credential_hash,operation,payload);
  if not already_recorded then
   select * into d from public.search_documents where user_id=c.user_id and kind='portals' and id='shared' for update;
   if not found then raise exception 'Save canonical portals first' using errcode='P0002';end if;
   select d.projection||jsonb_build_object('tracked_companies',jsonb_agg(case when source->>'id'=payload->'result'->>'targetId' then (source-array['provider','api','keywords'])||(payload->'result'->'options')||jsonb_build_object('provider',payload->'result'->>'provider') else source end)) into portals from jsonb_array_elements(d.projection->'tracked_companies') source;
   perform private.write_search_document(c.user_id,'portals','shared',d.version,portals::text);
  end if;
  return response;
 end if;
 if operation in ('search.document.save','search.request') and not 'preferences:write'=any(c.scopes) or operation in ('search.run.start','search.progress','search.discoveries.save','search.screening.save','search.run.finish') and not 'drafts:write'=any(c.scopes) then raise exception 'Write scope required' using errcode='42501';end if;
 return private.search_owned(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

-- Search tasks can complete with a real closed sweep even when it found no jobs.
-- Existing onboarding discovery tasks retain their owned-batch requirement.
alter function private.onboarding_action(uuid,text,jsonb,uuid) rename to search_onboarding_previous;
create function private.onboarding_action(owner_id uuid,operation text,payload jsonb,connection_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t private.agent_tasks;r public.search_runs;
begin
 if operation='tasks.claim' then
  select * into t from private.agent_tasks where user_id=owner_id and id=(payload->>'taskId')::uuid for update;
  if t.target ? 'searchProfileId' and connection_id is not null and t.claimed_by=connection_id and t.state in ('claimed','running') and t.lease_until>now() then
   update private.agent_tasks set lease_until=now()+interval '5 minutes',updated_at=now() where id=t.id returning * into t;
   return to_jsonb(t);
  end if;
 end if;
 if operation='tasks.report_result' and payload->>'state'='completed' then
  select * into t from private.agent_tasks where user_id=owner_id and id=(payload->>'taskId')::uuid for update;
  if t.target ? 'searchProfileId' then
   if connection_id is null then raise exception 'Agent credential required' using errcode='42501';end if;
   if t.claimed_by=connection_id and t.claim_token=(payload->>'claimToken')::uuid and t.state='completed' and t.result=payload->'result' then return to_jsonb(t);end if;
   if t.claimed_by is distinct from connection_id or t.claim_token is distinct from (payload->>'claimToken')::uuid or t.lease_until<now() or t.revision is distinct from (payload->>'expectedRevision')::bigint or t.state not in ('claimed','running') then raise exception 'Current claim required' using errcode='40001';end if;
   select * into r from public.search_runs where user_id=owner_id and id=(payload->'result'->>'searchRunId')::uuid;
   if r.id is null or r.profile_id<>t.target->>'searchProfileId' or r.state not in ('completed','partial') or length(trim(coalesce(payload->'result'->>'summary',''))) not between 3 and 2000 then raise exception 'Finished owned search run and summary required' using errcode='22023';end if;
   update private.agent_tasks set state='completed',result=payload->'result',revision=revision+1,updated_at=now() where id=t.id returning * into t;
   return to_jsonb(t);
  end if;
 end if;
 return private.search_onboarding_previous(owner_id,operation,payload,connection_id);
end $$;
revoke all on function private.onboarding_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.onboarding_action(uuid,text,jsonb,uuid) to service_role;
commit;
