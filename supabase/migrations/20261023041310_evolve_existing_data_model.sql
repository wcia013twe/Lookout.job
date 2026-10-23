-- Evolve existing records; personal agents continue to perform inference.
begin;

create or replace function private.replace_resume_source_owned(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.resumes; fresh public.resumes;prefs public.preferences;next_search jsonb;profile jsonb;instructions text;rules jsonb; canonical public.search_documents;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['resumeId','replacementId','expectedVersion']<>'{}' or not payload ?& array['resumeId','replacementId','expectedVersion'] or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or payload->>'expectedVersion' !~ '^[1-9][0-9]*$' then raise exception 'Resume IDs and current version required' using errcode='22023';end if;
 -- Use the same lock order as canonical document writes, before locking preferences.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,71));
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,83));
 select * into old from public.resumes where user_id=owner_id and id=(payload->>'resumeId')::uuid for update;
 select * into fresh from public.resumes where user_id=owner_id and id=(payload->>'replacementId')::uuid for update;
 if old.id is null or fresh.id is null then raise exception 'Owned resumes required' using errcode='P0002';end if;
 if old.id=fresh.id or old.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Resume changed; reload before replacing' using errcode='40001';end if;
 if old.superseded_by is not null and old.superseded_by<>fresh.id then raise exception 'Resume source changed; reload' using errcode='40001';end if;
 if old.superseded_by is null then
  if fresh.object_path is null or fresh.content_hash is null or fresh.object_path not like owner_id::text||'/%' or fresh.superseded_by is not null or exists(select 1 from public.resumes where superseded_by=fresh.id) then raise exception 'New owned uploaded file required' using errcode='22023';end if;
  -- Keep both immutable file rows. Existing drafts and approvals keep the old ID/hash.
  update public.resumes set name=old.name,variant=old.variant,version=old.version+1 where id=fresh.id returning * into fresh;
  update public.resumes set superseded_by=fresh.id where id=old.id returning * into old;
  insert into public.preferences(user_id) values(owner_id) on conflict(user_id) do nothing;
  select * into prefs from public.preferences where user_id=owner_id for update;
  next_search:=coalesce(prefs.search,'{}');
  if next_search->>'defaultResumeId'=old.id::text then next_search:=jsonb_set(next_search,'{defaultResumeId}',to_jsonb(fresh.id::text));end if;
  if jsonb_typeof(next_search->'resumeRules')='array' then
   select coalesce(jsonb_agg(case when x->>'resumeId'=old.id::text then jsonb_set(x,'{resumeId}',to_jsonb(fresh.id::text)) else x end),'[]') into rules from jsonb_array_elements(next_search->'resumeRules') x;
   next_search:=jsonb_set(next_search,'{resumeRules}',rules);
  end if;
  update public.preferences set search=next_search,updated_at=now() where user_id=owner_id;
  for profile in select value from jsonb_array_elements(coalesce(next_search->'profiles','[]')) loop
   select * into canonical from public.search_documents where user_id=owner_id and kind='profile' and id=profile->>'id';
   instructions:=coalesce(canonical.projection->>'instructions',profile->>'instructions','');
   instructions:=regexp_replace(instructions,'(- Default resume ID: *)'||old.id::text||'([[:space:]]|$)',E'\\1'||fresh.id::text||E'\\2','g');
   instructions:=regexp_replace(instructions,'("resumeId"[[:space:]]*:[[:space:]]*")'||old.id::text||'(")',E'\\1'||fresh.id::text||E'\\2','g');
   if instructions is distinct from coalesce(canonical.projection->>'instructions',profile->>'instructions','') then
    perform private.save_search_profile_for_owner(owner_id,coalesce((profile->>'version')::integer,0),
      (coalesce(canonical.projection,profile)-'version')||jsonb_build_object('instructions',instructions));
   end if;
  end loop;
  select search into next_search from public.preferences where user_id=owner_id;
 else select p.search into next_search from public.preferences p where p.user_id=owner_id;
 end if;
 return jsonb_build_object('previous',to_jsonb(old),'resume',to_jsonb(fresh),'search',coalesce(next_search,'{}'));
end $$;

-- A private lead may precede publication. Linking it never publishes its evidence.
alter table public.search_listings add column job_id text references public.jobs(id) on delete set null;
create index search_listing_canonical_url on public.search_listings(canonical_url);
create index search_listing_job on public.search_listings(job_id) where job_id is not null;
update public.search_listings l set job_id=j.id from public.jobs j where j.canonical_url=l.canonical_url;
create function private.link_search_listing_job() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Serialize publication and discovery for the same URL, including concurrent inserts.
 perform pg_advisory_xact_lock(hashtextextended(new.canonical_url,84));
 select j.id into new.job_id from public.jobs j where j.canonical_url=new.canonical_url;
 return new;
end $$;
create trigger search_listing_job_link before insert or update of canonical_url on public.search_listings for each row execute function private.link_search_listing_job();
create function private.link_published_job_listings() returns trigger language plpgsql security definer set search_path='' as $$
declare url text;
begin
 for url in select distinct value from unnest(array[new.canonical_url,case when tg_op='UPDATE' then old.canonical_url end]) value where value is not null order by value loop
  perform pg_advisory_xact_lock(hashtextextended(url,84));
 end loop;
 if tg_op='UPDATE' and old.canonical_url is distinct from new.canonical_url then
  update public.search_listings set job_id=null where job_id=new.id and canonical_url<>new.canonical_url;
 end if;
 update public.search_listings set job_id=new.id where canonical_url=new.canonical_url and job_id is distinct from new.id;
 return new;
end $$;
create trigger published_job_listing_link after insert or update of canonical_url on public.jobs for each row execute function private.link_published_job_listings();
revoke all on function private.link_search_listing_job(),private.link_published_job_listings() from public,anon,authenticated;


create or replace function private.search_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
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
    'jobId',f.job_id,
    'applications',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'jobId',a.job_id)) from public.applications a where a.user_id=owner_id and a.job_id=f.job_id),'[]')) item
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

create or replace function private.validate_artifact_content(owner_id uuid,doc jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; parent_id uuid;
begin
 if jsonb_typeof(doc) is distinct from 'object' or doc-array['title','purpose','kind','format','body','weekOf','company','sources','links','materials','preparedFor']<>'{}'
  or jsonb_typeof(doc->'title') is distinct from 'string' or length(trim(doc->>'title')) not between 1 and 200
  or jsonb_typeof(doc->'purpose') is distinct from 'string' or length(trim(doc->>'purpose')) not between 1 and 1000
  or jsonb_typeof(doc->'body') is distinct from 'string' or length(trim(doc->>'body')) not between 1 and 150000
  or coalesce(doc->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes','cover_letter','application_template')
  or coalesce(doc->>'format','') not in ('markdown','html')
  or jsonb_typeof(doc->'sources') is distinct from 'array' or jsonb_array_length(doc->'sources')>30
  or jsonb_typeof(doc->'links') is distinct from 'array' or jsonb_array_length(doc->'links')>50
  or (doc ? 'weekOf' and (jsonb_typeof(doc->'weekOf') is distinct from 'string' or not private.valid_artifact_date(doc->>'weekOf')))
  or (doc ? 'company' and (jsonb_typeof(doc->'company') is distinct from 'string' or length(doc->>'company')>200))
 then raise exception 'Invalid artifact content' using errcode='22023';end if;

 if doc ? 'preparedFor' and (jsonb_typeof(doc->'preparedFor') is distinct from 'string' or not private.valid_artifact_date(doc->>'preparedFor') or doc->>'kind' not in ('weekly_prep','interview_brief')) then raise exception 'Dated preparation required' using errcode='22023';end if;
 if doc ? 'materials' then
  if doc->>'kind' not in ('weekly_prep','interview_brief') or doc->>'format'<>'markdown' or jsonb_typeof(doc->'materials') is distinct from 'array' then raise exception 'Markdown prep collection required' using errcode='22023';end if;
  if jsonb_array_length(doc->'materials')>20 then raise exception 'At most 20 materials' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(doc->'materials') loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['id','version']<>'{}' or jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'version') is distinct from 'number' or item->>'version' !~ '^[1-9][0-9]*$' then raise exception 'Saved revision required' using errcode='22023';end if;
   if not exists(select 1 from public.career_artifact_revisions v where v.user_id=owner_id and v.artifact_id=(item->>'id')::uuid and v.version=(item->>'version')::integer and v.content->>'kind' not in ('cover_letter','application_template') and jsonb_array_length(coalesce(v.content->'materials','[]'))=0) then raise exception 'Owned non-collection material revision required' using errcode='P0002';end if;
  end loop;
  if (select count(*) from jsonb_array_elements(doc->'materials'))<>(select count(distinct (value->>'id')::uuid) from jsonb_array_elements(doc->'materials')) then raise exception 'Duplicate materials' using errcode='22023';end if;
 end if;
 for item in select value from jsonb_array_elements(doc->'sources') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['title','url','observedAt']<>'{}' or jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or jsonb_typeof(item->'url') is distinct from 'string' or not private.valid_artifact_source(item->>'url') or jsonb_typeof(item->'observedAt') is distinct from 'string' or not private.valid_artifact_date(item->>'observedAt') then raise exception 'Dated HTTPS sources required' using errcode='22023';end if;
 end loop;
 -- One typed subject per link; a task is optional for applications/goals.
 for item in select value from jsonb_array_elements(doc->'links') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['applicationId','goalId','companyWorkspaceId','contactId','jobId','taskId']<>'{}'
   or (select count(*) from jsonb_object_keys(item-'taskId'))<>1
   or exists(select 1 from jsonb_each(item) e where jsonb_typeof(e.value) is distinct from 'string' or length(trim(e.value#>>'{}')) not between 1 and 200)
   or (item ? 'taskId' and not (item ? 'applicationId' or item ? 'goalId'))
  then raise exception 'One typed subject and optional application/goal task required' using errcode='22023';end if;
  if item ? 'applicationId' then
   parent_id:=(item->>'applicationId')::uuid;
   if not exists(select 1 from public.applications a where a.user_id=owner_id and a.id=parent_id) then raise exception 'Owned application required' using errcode='P0002';end if;
   if item ? 'taskId' and not exists(select 1 from public.preparation_plans p,jsonb_array_elements(p.plan->'tasks') t where p.user_id=owner_id and p.application_id=parent_id and t->>'id'=item->>'taskId') then raise exception 'Owned interview task required' using errcode='P0002';end if;
  elsif item ? 'goalId' then
   parent_id:=(item->>'goalId')::uuid;
   if not exists(select 1 from public.learning_goals g where g.user_id=owner_id and g.id=parent_id and (not item ? 'taskId' or exists(select 1 from jsonb_array_elements(g.goal->'tasks') t where t->>'id'=item->>'taskId'))) then raise exception 'Owned learning goal/task required' using errcode='P0002';end if;
  elsif item ? 'companyWorkspaceId' then
   if not exists(select 1 from public.company_workspaces w where w.user_id=owner_id and w.id=item->>'companyWorkspaceId') then raise exception 'Owned company workspace required' using errcode='P0002';end if;
  elsif item ? 'contactId' then
   if not exists(select 1 from public.outreach_contacts c where c.user_id=owner_id and c.id=item->>'contactId' and c.deleted_at is null and c.record->>'collection' is distinct from 'companies') then raise exception 'Owned contact required' using errcode='P0002';end if;
  elsif item ? 'jobId' then
   if not exists(select 1 from public.jobs j where j.id=item->>'jobId') then raise exception 'Published job required' using errcode='P0002';end if;
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(doc->'links'))<>(select count(distinct case when value ? 'applicationId' then jsonb_set(value,'{applicationId}',to_jsonb(lower(value->>'applicationId'))) when value ? 'goalId' then jsonb_set(value,'{goalId}',to_jsonb(lower(value->>'goalId'))) else value end) from jsonb_array_elements(doc->'links')) then raise exception 'Duplicate subject links' using errcode='22023';end if;
end $$;

create or replace function private.artifact_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.career_artifacts; previous public.learning_goals; saved public.learning_goals;
 doc jsonb; item jsonb; old_task jsonb; next_tasks jsonb:='[]'; item_id uuid; expected integer; requested_version integer; result jsonb; off integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Object required' using errcode='22023';end if;
 if operation='learning.read' then
  if payload<>'{}' then raise exception 'Unknown argument' using errcode='22023';end if;
  return (select coalesce(jsonb_agg(to_jsonb(g) order by updated_at desc,id),'[]') from public.learning_goals g where user_id=owner_id);
 elsif operation='artifacts.list' then
  if payload-array['query','kind','weekOf','applicationId','goalId','companyWorkspaceId','contactId','jobId','archived','offset','shelf','asOf']<>'{}' or (payload ? 'query' and (jsonb_typeof(payload->'query') is distinct from 'string' or length(payload->>'query')>200)) or (payload ? 'archived' and jsonb_typeof(payload->'archived') is distinct from 'boolean') or (payload ? 'offset' and (jsonb_typeof(payload->'offset') is distinct from 'number' or payload->>'offset' !~ '^[0-9]+$')) or (payload ? 'weekOf' and not private.valid_artifact_date(payload->>'weekOf')) then raise exception 'Invalid artifact filters' using errcode='22023';end if;
  if payload ? 'shelf' and (jsonb_typeof(payload->'shelf') is distinct from 'string' or payload->>'shelf' not in ('prepared','saved','all')) or payload ? 'asOf' and (not payload ? 'shelf' or jsonb_typeof(payload->'asOf') is distinct from 'string' or not private.valid_artifact_date(payload->>'asOf')) then raise exception 'Valid shelf and local date required' using errcode='22023';end if;
  if payload ? 'kind' and coalesce(payload->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes','cover_letter','application_template') then raise exception 'Unknown artifact kind' using errcode='22023';end if;
  if payload ? 'applicationId' then item_id:=(payload->>'applicationId')::uuid;end if;
  if payload ? 'goalId' then item_id:=(payload->>'goalId')::uuid;end if;
  if exists(select 1 from jsonb_each(payload) e where e.key in ('companyWorkspaceId','contactId','jobId') and (jsonb_typeof(e.value) is distinct from 'string' or length(trim(e.value#>>'{}')) not between 1 and 200)) then raise exception 'Bounded subject ID required' using errcode='22023';end if;
  off:=coalesce((payload->>'offset')::integer,0);if off not between 0 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(q.item order by case when payload->>'shelf'='prepared' then q.item->'content'->>'preparedFor' end,q.updated_at desc,q.id),'[]') into result from (
   select (private.artifact_response(a)-'content')||jsonb_build_object('content',content-'body') as item,updated_at,id
   from public.career_artifacts a where user_id=owner_id and archived=coalesce((payload->>'archived')::boolean,false)
   and (not payload ? 'shelf' or (content->>'kind' not in ('cover_letter','application_template') and (payload->>'shelf'='all' or (coalesce(content->>'kind' in ('weekly_prep','interview_brief') and private.valid_artifact_date(content->>'preparedFor') and content->>'preparedFor'>=coalesce(payload->>'asOf',current_date::text),false))=(payload->>'shelf'='prepared'))))
   and (not payload ? 'query' or position(lower(payload->>'query') in lower((content->>'title')||' '||(content->>'purpose')||' '||coalesce(content->>'company','')||' '||(content->>'body')))>0)
   and (not payload ? 'kind' or content->>'kind'=payload->>'kind') and (not payload ? 'weekOf' or content->>'weekOf'=payload->>'weekOf')
   and (not payload ? 'applicationId' or exists(select 1 from jsonb_array_elements(content->'links') l where (l->>'applicationId')::uuid=(payload->>'applicationId')::uuid))
   and (not payload ? 'goalId' or exists(select 1 from jsonb_array_elements(content->'links') l where (l->>'goalId')::uuid=(payload->>'goalId')::uuid))
   and not exists(select 1 from jsonb_each_text(payload) f where f.key in ('companyWorkspaceId','contactId','jobId') and not exists(select 1 from jsonb_array_elements(content->'links') l where l->>f.key=f.value))
   order by case when payload->>'shelf'='prepared' then content->>'preparedFor' end,updated_at desc,id limit 26 offset off
  ) q;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextOffset',case when jsonb_array_length(result)>25 then off+25 else null end);
 elsif operation='artifacts.read' then
  if payload-array['id','version']<>'{}' then raise exception 'Unknown read argument' using errcode='22023';end if;
  select * into r from public.career_artifacts where user_id=owner_id and id=(payload->>'id')::uuid;
  if not found then raise exception 'Owned artifact required' using errcode='P0002';end if;
  if payload ? 'version' then
   if jsonb_typeof(payload->'version') is distinct from 'number' or payload->>'version' !~ '^[1-9][0-9]*$' then raise exception 'Revision required' using errcode='22023';end if;
   requested_version:=(payload->>'version')::integer;
   select content,version,archived,created_at into r.content,r.version,r.archived,r.updated_at from public.career_artifact_revisions where user_id=owner_id and artifact_id=r.id and version=requested_version;
   if not found then raise exception 'Revision not found' using errcode='P0002';end if;
  end if;
  return private.artifact_response(r)||jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('version',version,'title',content->>'title','created_at',created_at) order by version desc),'[]') from (select * from public.career_artifact_revisions where user_id=owner_id and artifact_id=r.id order by version desc limit 50) z));
 end if;
 if operation not in ('artifacts.save','artifacts.archive','learning.save') then raise exception 'Unknown artifact operation' using errcode='22023';end if;
 if jsonb_typeof(payload->'id') is distinct from 'string' or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or payload->>'expectedVersion' !~ '^[0-9]+$' then raise exception 'ID and current version required' using errcode='22023';end if;
 item_id:=(payload->>'id')::uuid;expected:=(payload->>'expectedVersion')::integer;
 if item_id is null or expected>2147483646 then raise exception 'Invalid version' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(item_id::text,82));
 if operation='learning.save' then
  doc:=payload-array['id','expectedVersion'];
  if doc-array['title','objective','active','tasks']<>'{}' or jsonb_typeof(doc->'title') is distinct from 'string' or length(trim(doc->>'title')) not between 1 and 200 or jsonb_typeof(doc->'objective') is distinct from 'string' or length(trim(doc->>'objective')) not between 1 and 2000 or jsonb_typeof(doc->'active') is distinct from 'boolean' or jsonb_typeof(doc->'tasks') is distinct from 'array' or jsonb_array_length(doc->'tasks')>30 then raise exception 'Invalid learning goal' using errcode='22023';end if;
  select * into previous from public.learning_goals where id=item_id for update;
  if found and previous.user_id<>owner_id then raise exception 'Owned goal required' using errcode='P0002';end if;
  for item in select value from jsonb_array_elements(doc->'tasks') loop
   if jsonb_typeof(item) is distinct from 'object' or item-array['id','title','detail','minutes','targetDate']<>'{}' or jsonb_typeof(item->'id') is distinct from 'string' or length(trim(item->>'id')) not between 1 and 100 or jsonb_typeof(item->'title') is distinct from 'string' or length(trim(item->>'title')) not between 1 and 200 or jsonb_typeof(item->'detail') is distinct from 'string' or length(item->>'detail')>2000 or jsonb_typeof(item->'minutes') is distinct from 'number' or item->>'minutes' !~ '^[0-9]+$' or (item->>'minutes')::integer not between 1 and 240 or jsonb_typeof(item->'targetDate') is distinct from 'string' or not private.valid_artifact_date(item->>'targetDate') then raise exception 'Invalid dated learning task' using errcode='22023';end if;
   select value into old_task from jsonb_array_elements(coalesce(previous.goal->'tasks','[]')) where value->>'id'=item->>'id';
   if old_task->>'completed'='true' then item:=old_task;
   else
    if old_task is not null and exists(select 1 from public.preparation_sessions s,jsonb_array_elements(s.targets) t where s.user_id=owner_id and t->>'goalId'=item_id::text and t->>'taskId'=item->>'id') then item:=item||jsonb_build_object('minutes',old_task->'minutes');end if;
    item:=item||jsonb_build_object('completed',false);
   end if;
   next_tasks:=next_tasks||jsonb_build_array(item);
  end loop;
  if jsonb_array_length(next_tasks)<>(select count(distinct value->>'id') from jsonb_array_elements(next_tasks)) then raise exception 'Duplicate task IDs' using errcode='22023';end if;
  for old_task in select value from jsonb_array_elements(coalesce(previous.goal->'tasks','[]')) loop
   if old_task->>'completed'='true' and not exists(select 1 from jsonb_array_elements(next_tasks) t where t->>'id'=old_task->>'id') then next_tasks:=next_tasks||jsonb_build_array(old_task);end if;
  end loop;
  doc:=jsonb_set(doc,'{tasks}',next_tasks);
  if previous.id is not null then
   if previous.version=expected+1 and previous.goal=doc then return to_jsonb(previous);end if;
   if previous.version<>expected then raise exception 'Goal changed; reload' using errcode='40001';end if;
   update public.learning_goals set goal=doc,version=version+1,updated_at=now() where id=item_id returning * into saved;
  else
   if expected<>0 then raise exception 'Goal changed; reload' using errcode='40001';end if;
   insert into public.learning_goals(id,user_id,goal) values(item_id,owner_id,doc) returning * into saved;
  end if;
  return to_jsonb(saved);
 end if;
 select * into r from public.career_artifacts where id=item_id for update;
 if r.id is not null and r.user_id<>owner_id then raise exception 'Owned artifact required' using errcode='P0002';end if;
 if operation='artifacts.archive' then
  if payload-array['id','expectedVersion','archived']<>'{}' or jsonb_typeof(payload->'archived') is distinct from 'boolean' then raise exception 'Archive flag required' using errcode='22023';end if;
  if r.id is null then raise exception 'Owned artifact required' using errcode='P0002';end if;
  if r.version=expected+1 and r.archived=(payload->>'archived')::boolean then return private.artifact_response(r);end if;
  if r.version<>expected then raise exception 'Artifact changed; reload' using errcode='40001';end if;
  update public.career_artifacts set archived=(payload->>'archived')::boolean,version=version+1,updated_at=now() where id=item_id returning * into r;
 else
  doc:=payload-array['id','expectedVersion'];
  if r.id is not null and r.version=expected+1 and r.content=doc then return private.artifact_response(r);end if;
  perform private.validate_artifact_content(owner_id,doc);
  if exists(select 1 from jsonb_array_elements(coalesce(doc->'materials','[]')) m where (m->>'id')::uuid=item_id) then raise exception 'Self reference not allowed' using errcode='22023';end if;
  if r.id is not null then
   if r.version=expected+1 and r.content=doc then return private.artifact_response(r);end if;
   if r.version<>expected then raise exception 'Artifact changed; reload' using errcode='40001';end if;
   update public.career_artifacts set content=doc,version=version+1,updated_at=now() where id=item_id returning * into r;
  else
   if expected<>0 then raise exception 'Artifact changed; reload' using errcode='40001';end if;
   insert into public.career_artifacts(id,user_id,content) values(item_id,owner_id,doc) returning * into r;
  end if;
 end if;
 insert into public.career_artifact_revisions(artifact_id,user_id,version,content,archived) values(r.id,owner_id,r.version,r.content,r.archived);
 return private.artifact_response(r);
end $$;

commit;
