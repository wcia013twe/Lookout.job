begin;
-- Maintainer-owned identities; a private workspace is never the registry.
create table public.companies (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 200),
 domain text check(domain ~ '^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$'), aliases text[] not null default '{}',
 check(cardinality(aliases)<=50)
);
alter table public.companies enable row level security;
create policy company_registry_read on public.companies for select to authenticated using(true);
revoke all on public.companies from public,anon,authenticated;
grant select on public.companies to authenticated;
grant all on public.companies to service_role;
create function private.company_key(value text) returns text language sql immutable set search_path='' as $$ select lower(regexp_replace(trim(value),'\s+',' ','g')) $$;
create function private.resolve_company(value text, website text default '') returns uuid language sql stable set search_path='' as $$
 with matches as (select * from public.companies c where private.company_key(c.name)=private.company_key(value) or exists(select 1 from unnest(c.aliases) a where private.company_key(a)=private.company_key(value)))
 select id from matches c where (select count(*) from matches)=1 and (coalesce(website,'')='' or c.domain is null or lower(substring(website from '^https://(?:www\.)?([^/:?#]+)'))=c.domain)
$$;
-- Initial explicit registry; aliases identify the same company, never parents/brands.
insert into public.companies(id,name,domain,aliases) values
 ('c0000000-0000-4000-8000-000000000001','Databricks','databricks.com',array['Databricks Inc.']),
 ('c0000000-0000-4000-8000-000000000002','NVIDIA','nvidia.com',array['NVIDIA Corporation']),
 ('c0000000-0000-4000-8000-000000000003','Together AI','together.ai',array['Together.ai']),
 ('c0000000-0000-4000-8000-000000000004','Oracle','oracle.com','{}'),
 ('c0000000-0000-4000-8000-000000000005','Stripe','stripe.com',array['Stripe, Inc.']),
 ('c0000000-0000-4000-8000-000000000006','Snowflake','snowflake.com',array['Snowflake Inc.']);
create table public.company_workspaces (
 user_id uuid not null references auth.users(id) on delete cascade, id text not null check(length(id) between 1 and 200),
 company_id uuid references public.companies(id), name text not null, website text not null default '',
 priority text not null default 'Strong Consider' check(priority in ('Apply Now','Strong Consider','Skip Unless Team Fit')),
 interest text not null default '', target_teams text not null default '', concerns text not null default '',research text not null default '',
 next_action text not null default '',follow_up_date date,sources jsonb not null default '[]',contact_ids text[] not null default '{}',application_ids text[] not null default '{}',
 archived boolean not null default false,revision integer not null default 1 check(revision>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 needs_review boolean not null default false,legacy_notes text,
 primary key(user_id,id),unique(user_id,company_id),check(jsonb_typeof(sources)='array' and jsonb_array_length(sources)<=30),
 check(cardinality(contact_ids)<=100 and cardinality(application_ids)<=100)
);
alter table public.company_workspaces enable row level security;
create policy company_workspace_read on public.company_workspaces for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.company_workspaces from public,anon,authenticated;
grant select on public.company_workspaces to authenticated;
grant all on public.company_workspaces to service_role;
create function private.company_record(w public.company_workspaces) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('name',w.name,'website',w.website,'priority',w.priority,'interest',w.interest,'targetTeams',w.target_teams,'concerns',w.concerns,'research',w.research,'nextAction',w.next_action,'followUpDate',coalesce(w.follow_up_date::text,''),'sources',w.sources,'contactIds',to_jsonb(w.contact_ids),'applicationIds',to_jsonb(w.application_ids),'archived',w.archived)
$$;
create function private.company_projection(w public.company_workspaces) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',w.id,'companyId',w.company_id,'record',private.company_record(w),'revision',w.revision,'created_at',w.created_at,'updated_at',w.updated_at,'needsReview',w.needs_review,'legacyNotes',w.legacy_notes)
$$;
create function private.validate_company_record(r jsonb) returns void language plpgsql set search_path='' as $$
declare k text; s jsonb; v text;
begin
 if jsonb_typeof(r) is distinct from 'object' or not r ?& array['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate','sources','contactIds','applicationIds','archived'] or exists(select 1 from jsonb_object_keys(r) f where f not in ('name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate','sources','contactIds','applicationIds','archived')) or octet_length(r::text)>24000 then raise exception 'Complete bounded company record required' using errcode='22023'; end if;
 foreach k in array array['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate'] loop
  if jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>(case k when 'name' then 200 when 'website' then 2048 when 'priority' then 30 when 'followUpDate' then 10 else 10000 end) then raise exception 'Invalid company field: %',k using errcode='22023'; end if;
 end loop;
 if trim(r->>'name')='' or r->>'priority' not in ('Apply Now','Strong Consider','Skip Unless Team Fit') or jsonb_typeof(r->'archived') is distinct from 'boolean' then raise exception 'Name, priority and archive state required' using errcode='22023'; end if;
 if r->>'website'<>'' and r->>'website' !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' then raise exception 'HTTPS website required' using errcode='22023'; end if;
 if r->>'followUpDate'<>'' and (r->>'followUpDate' !~ '^\d{4}-\d{2}-\d{2}$' or (r->>'followUpDate')::date::text<>r->>'followUpDate') then raise exception 'Valid follow-up date required' using errcode='22023'; end if;
 if jsonb_typeof(r->'sources') is distinct from 'array' then raise exception 'Source array required' using errcode='22023'; end if;
 if jsonb_array_length(r->'sources')>30 then raise exception 'Too many sources' using errcode='22023'; end if;
 for s in select * from jsonb_array_elements(r->'sources') loop
  if jsonb_typeof(s) is distinct from 'object' or not s ?& array['title','url','observedAt','summary'] or exists(select 1 from jsonb_each(s) e where e.key not in ('title','url','observedAt','summary') or jsonb_typeof(e.value) is distinct from 'string' or length(e.value#>>'{}')>case e.key when 'title' then 200 when 'url' then 2048 when 'observedAt' then 10 else 2000 end) or trim(s->>'title')='' or s->>'url' !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or s->>'observedAt' !~ '^\d{4}-\d{2}-\d{2}$' or (s->>'observedAt')::date::text<>s->>'observedAt' then raise exception 'Invalid dated research source' using errcode='22023'; end if;
 end loop;
 foreach k in array array['contactIds','applicationIds'] loop
  if jsonb_typeof(r->k) is distinct from 'array' then raise exception 'Link array required' using errcode='22023'; end if;
  if jsonb_array_length(r->k)>100 or exists(select 1 from jsonb_array_elements(r->k) i where jsonb_typeof(i) is distinct from 'string' or length(i#>>'{}') not between 1 and 200) or (select count(distinct i) from jsonb_array_elements_text(r->k) i)<>jsonb_array_length(r->k) then raise exception 'Invalid company links' using errcode='22023'; end if;
 end loop;
end $$;
-- Transactional import: untouched legacy rows are evidence, not a second active store.
do $$
declare o public.outreach_contacts; r jsonb; invalid boolean;
begin
 for o in select * from public.outreach_contacts where record->>'collection'='companies' loop
  invalid:=false;
  begin r:=(o.record->>'notes')::jsonb; perform private.validate_company_record(r);
  exception when others then
   invalid:=true;
   r:=jsonb_build_object('name',coalesce(nullif(o.record->>'company',''),'Unnamed company'),'website','','priority','Strong Consider','interest','','targetTeams','','concerns','','research',coalesce(o.record->>'notes',''),'nextAction','','followUpDate','','sources','[]'::jsonb,'contactIds','[]'::jsonb,'applicationIds','[]'::jsonb,'archived',false);
   begin if nullif(o.record->>'followUpDate','') is not null then r:=jsonb_set(r,'{followUpDate}',to_jsonb((o.record->>'followUpDate')::date::text)); end if; exception when others then null; end;
  end;
  insert into public.company_workspaces(user_id,id,name,website,priority,interest,target_teams,concerns,research,next_action,follow_up_date,sources,contact_ids,application_ids,archived,revision,created_at,updated_at,needs_review,legacy_notes)
  values(o.user_id,o.id,r->>'name',r->>'website',r->>'priority',r->>'interest',r->>'targetTeams',r->>'concerns',r->>'research',r->>'nextAction',nullif(r->>'followUpDate','')::date,r->'sources',array(select jsonb_array_elements_text(r->'contactIds')),array(select jsonb_array_elements_text(r->'applicationIds')),(r->>'archived')::boolean or o.deleted_at is not null,o.revision,o.updated_at,o.updated_at,invalid,o.record->>'notes');
 end loop;
 -- Only singleton identities can be linked. Every duplicate survives unresolved.
 update public.company_workspaces w set company_id=private.resolve_company(w.name,w.website)
 where private.resolve_company(w.name,w.website) is not null and not exists(select 1 from public.company_workspaces other where other.user_id=w.user_id and other.id<>w.id and private.resolve_company(other.name,other.website)=private.resolve_company(w.name,w.website));
 update public.company_workspaces w set needs_review=true where exists(select 1 from public.company_workspaces other where other.user_id=w.user_id and other.id<>w.id and (private.company_key(other.name)=private.company_key(w.name) or private.resolve_company(other.name,other.website)=private.resolve_company(w.name,w.website)));
 update public.outreach_contacts set deleted_at=coalesce(deleted_at,now()) where record->>'collection'='companies';
end $$;
create function private.company_actions(owner_id uuid,op text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare w public.company_workspaces; r jsonb; cid uuid; output jsonb; k text;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Arguments required' using errcode='22023'; end if;
 if op='companies.list' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('query','limit','offset')) or length(coalesce(payload->>'query',''))>200 or coalesce((payload->>'limit')::int,100) not between 1 and 100 or coalesce((payload->>'offset')::int,0)<0 then raise exception 'Invalid registry query' using errcode='22023'; end if;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select * from public.companies where coalesce(payload->>'query','')='' or private.company_key(name)=private.company_key(payload->>'query') or exists(select 1 from unnest(aliases) a where private.company_key(a)=private.company_key(payload->>'query')) order by name,id limit coalesce((payload->>'limit')::int,100) offset coalesce((payload->>'offset')::int,0)) c));
 elsif op='company_workspaces.list' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('limit','offset')) or coalesce((payload->>'limit')::int,1000) not between 1 and 1000 or coalesce((payload->>'offset')::int,0)<0 then raise exception 'Invalid workspace query' using errcode='22023'; end if;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(private.company_projection(c)),'[]') from (select * from public.company_workspaces where user_id=owner_id order by id limit coalesce((payload->>'limit')::int,1000) offset coalesce((payload->>'offset')::int,0)) c));
 elsif op<>'company_workspaces.save' then raise exception 'Unknown company action' using errcode='22023'; end if;
 if not payload ?& array['id','record','expectedRevision'] or exists(select 1 from jsonb_object_keys(payload) k where k not in ('id','record','expectedRevision','companyId')) or jsonb_typeof(payload->'id') is distinct from 'string' or length(payload->>'id') not between 1 and 200 or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision')::int<0 then raise exception 'ID and current revision required' using errcode='22023'; end if;
 r:=payload->'record'; perform private.validate_company_record(r);
 -- Owner serialization also closes races creating a linked workspace under different IDs.
 perform pg_advisory_xact_lock(hashtext(owner_id::text));
 select * into w from public.company_workspaces where user_id=owner_id and id=payload->>'id' for update;
 if coalesce(w.revision,0)<>(payload->>'expectedRevision')::int then raise exception 'Company changed; reload saved record. Your draft is preserved.' using errcode='40001'; end if;
 cid:=private.resolve_company(r->>'name',r->>'website');
 if payload->>'companyId' is not null and ((payload->>'companyId')::uuid is distinct from cid) then raise exception 'Company identity does not match; re-resolve name and website' using errcode='22023'; end if;
 -- Historical unresolved duplicates remain editable without silently merging/linking them.
 if exists(select 1 from public.company_workspaces where user_id=owner_id and id<>payload->>'id' and (company_id=cid or private.resolve_company(name,website)=cid)) then cid:=null; end if;
 -- Links annotate already-owned records; they never confer access through IDs.
 if exists(select 1 from jsonb_array_elements_text(r->'contactIds') link where not exists(select 1 from public.outreach_contacts c where c.user_id=owner_id and c.id=link and c.deleted_at is null and c.record->>'collection' is distinct from 'companies') and not (w.id is not null and link=any(w.contact_ids))) or exists(select 1 from jsonb_array_elements_text(r->'applicationIds') link where not exists(select 1 from public.applications a where a.user_id=owner_id and a.id::text=link) and not (w.id is not null and link=any(w.application_ids))) then raise exception 'Owned contact/application links required' using errcode='42501'; end if;
 insert into public.company_workspaces(user_id,id,company_id,name,website,priority,interest,target_teams,concerns,research,next_action,follow_up_date,sources,contact_ids,application_ids,archived,revision,needs_review)
 values(owner_id,payload->>'id',cid,r->>'name',r->>'website',r->>'priority',r->>'interest',r->>'targetTeams',r->>'concerns',r->>'research',r->>'nextAction',nullif(r->>'followUpDate','')::date,r->'sources',array(select jsonb_array_elements_text(r->'contactIds')),array(select jsonb_array_elements_text(r->'applicationIds')),(r->>'archived')::boolean,coalesce(w.revision,0)+1,w.needs_review is true or (cid is null and private.resolve_company(r->>'name',r->>'website') is not null))
 on conflict(user_id,id) do update set company_id=excluded.company_id,name=excluded.name,website=excluded.website,priority=excluded.priority,interest=excluded.interest,target_teams=excluded.target_teams,concerns=excluded.concerns,research=excluded.research,next_action=excluded.next_action,follow_up_date=excluded.follow_up_date,sources=excluded.sources,contact_ids=excluded.contact_ids,application_ids=excluded.application_ids,archived=excluded.archived,revision=excluded.revision,updated_at=now()
 returning * into w;
 return private.company_projection(w);
end $$;
create function public.company_action(operation text,payload jsonb default '{}',expected_owner uuid default auth.uid()) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Account changed; reload' using errcode='42501'; end if;
 return private.company_actions(auth.uid(),operation,payload);
end $$;
-- Narrow invoker wrapper invokes an owner-checked private service, not arbitrary SQL.
revoke all on function private.company_actions(uuid,text,jsonb) from public,anon,authenticated;
-- Public wrapper must be definer because private service cannot accept caller-selected owners.
alter function public.company_action(text,jsonb,uuid) security definer;
revoke all on function public.company_action(text,jsonb,uuid) from public,anon;
grant execute on function public.company_action(text,jsonb,uuid) to authenticated;
create function private.block_obsolete_company_contact() returns trigger language plpgsql set search_path='' as $$
begin
 if new.record->>'collection'='companies' or (tg_op='UPDATE' and old.record->>'collection'='companies') or exists(select 1 from public.company_workspaces where user_id=new.user_id and id=new.id) then raise exception 'Company storage changed. Reload required; use save_company_workspace.' using errcode='40001'; end if;
 return new;
end $$;
-- Definer lets direct browser writes check workspace IDs without widening table writes.
alter function private.block_obsolete_company_contact() security definer;
create trigger block_obsolete_company_contact before insert or update on public.outreach_contacts for each row execute function private.block_obsolete_company_contact();
alter table public.jobs add column company_id uuid references public.companies(id);
update public.jobs set company_id=private.resolve_company(employer->>'company');
alter table public.outreach_contacts add column company_id uuid references public.companies(id);
update public.outreach_contacts set company_id=private.resolve_company(record->>'company') where record->>'collection' is distinct from 'companies';
create function private.contact_company_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.company_id:=private.resolve_company(new.record->>'company');
 if new.record->>'companyId' is not null and (new.record->>'companyId')::uuid is distinct from new.company_id then raise exception 'Invalid company reference' using errcode='22023'; end if;
 return new;
end $$;
create trigger contact_company_reference before insert or update on public.outreach_contacts for each row execute function private.contact_company_reference();
create function private.job_company_reference() returns trigger language plpgsql security definer set search_path='' as $$
begin new.company_id:=private.resolve_company(new.employer->>'company'); return new; end $$;
create trigger job_company_reference before insert or update of employer on public.jobs for each row execute function private.job_company_reference();
revoke all on function private.job_company_reference() from public,anon,authenticated;
-- Scoped browser and MCP calls share this authoritative service.
alter function private.extended_actions_for_owner(uuid,text,jsonb) rename to company_previous_extended;
create or replace function private.company_previous_extended(owner_id uuid,operation text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; contact public.outreach_contacts; intent private.resume_upload_intents; a public.applications; result jsonb; required_scope text; allowed text[];
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 allowed:=case when operation='contacts.read' then array[]::text[] when operation='contacts.save' then array['id','record','expectedRevision'] when operation='contacts.delete' then array['id','expectedRevision'] when operation='applications.progress' then array['applicationId','expectedRevision','status','note','eventKey'] when operation='resumes.reference.add' then array['id','name','variant','version','url'] when operation='resumes.upload.begin' then array['id','name','variant','version','fileType','sizeBytes','sha256'] else array['id'] end;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& allowed or octet_length(payload::text)>100000 or exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed)) then raise exception 'Invalid arguments' using errcode='22023'; end if;
 if operation='contacts.read' then
  select coalesce(jsonb_agg(to_jsonb(x) order by updated_at desc,id),'[]') into result from public.outreach_contacts x where user_id=owner_id and deleted_at is null;
 elsif operation in ('contacts.save','contacts.delete') then
  if length(payload->>'id') not between 1 and 100 then raise exception 'Contact ID required' using errcode='22023'; end if;
  select * into contact from public.outreach_contacts where id=payload->>'id' and user_id=owner_id for update;
  if coalesce(contact.revision,0) is distinct from (payload->>'expectedRevision')::integer then raise exception 'Contact changed' using errcode='40001'; end if;
  if operation='contacts.delete' then
   if contact.id is null then raise exception 'Owned contact required' using errcode='P0002'; end if;
   update public.outreach_contacts set deleted_at=now(),revision=revision+1,updated_at=now() where id=contact.id and user_id=owner_id returning to_jsonb(outreach_contacts) into result;
  else
   if jsonb_typeof(payload->'record') is distinct from 'object' or jsonb_typeof(payload#>'{record,company}') is distinct from 'string' or coalesce(length(trim(payload#>>'{record,company}')),0) not between 1 and 200
    or exists(select 1 from jsonb_object_keys(payload->'record') k where k not in ('company','contact','name','title','role','contactType','linkedin','email','source','sourceUrl','status','subject','message','notes','followUpDate','jobUrl','employmentType','link','evidence','whyThem','ask','followUp','relationship','location','tags','collection','companyId')) then raise exception 'Invalid contact' using errcode='22023'; end if;
   if nullif(payload#>>'{record,linkedin}','') is not null and payload#>>'{record,linkedin}' !~ '^https://(www\.)?linkedin\.com/in/' then raise exception 'LinkedIn profile required' using errcode='22023'; end if;
   if contact.id is null then
    insert into public.outreach_contacts(id,user_id,record,revision) values(payload->>'id',owner_id,payload->'record',1) on conflict(user_id,id) do nothing returning to_jsonb(outreach_contacts) into result;
    if result is null then raise exception 'Contact changed' using errcode='40001'; end if;
   else
    update public.outreach_contacts set record=payload->'record',deleted_at=null where id=contact.id and user_id=owner_id returning to_jsonb(outreach_contacts) into result;
   end if;
  end if;
 elsif operation='resumes.reference.add' then
  if coalesce(payload->>'url','') !~ '^https://' or payload->>'url' ~ '^https://[^/]*@' or coalesce(length(trim(payload->>'name')),0) not between 1 and 200 or coalesce((payload->>'version')::integer,0)<1 then raise exception 'HTTPS resume reference required' using errcode='22023'; end if;
  insert into public.resumes(id,user_id,name,variant,version,reference_url) values((payload->>'id')::uuid,owner_id,payload->>'name',payload->>'variant',(payload->>'version')::integer,payload->>'url') on conflict(id) do nothing;
  select to_jsonb(x) into result from public.resumes x where id=(payload->>'id')::uuid and user_id=owner_id;
  if result is null then raise exception 'Owned resume required' using errcode='P0002'; end if;
  if result->>'reference_url' is distinct from payload->>'url' or result->>'name' is distinct from payload->>'name' or result->>'variant' is distinct from payload->>'variant' or result->>'version' is distinct from payload->>'version' then raise exception 'Resume ID conflict' using errcode='40001'; end if;
 elsif operation='applications.progress' then
  if payload->>'status' not in ('Submitted','Interview','Offer','Rejected','Withdrawn') or length(trim(payload->>'note')) not between 1 and 2000 or length(payload->>'eventKey') not between 1 and 200 then raise exception 'Progress report required' using errcode='22023'; end if;
  select e.payload into result from public.activity_events e where e.user_id=owner_id and e.event_key='progress:'||(payload->>'eventKey');
  if found then
   if result->'request' is distinct from payload then raise exception 'Event key conflict' using errcode='40001'; end if;
   return result;
  end if;
  select * into a from public.applications where id=(payload->>'applicationId')::uuid and user_id=owner_id for update;
  if a.id is null then raise exception 'Owned application required' using errcode='P0002'; end if;
  if a.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Application changed' using errcode='40001'; end if;
  if exists(select 1 from public.submission_attempts where application_id=a.id and state in ('claimed','started','uncertain')) then raise exception 'Submission requires human recovery' using errcode='22023'; end if;
  if payload->>'status' in ('Interview','Offer') and a.status not in ('Submitted','Interview','Offer') then raise exception 'Record submission first' using errcode='22023'; end if;
  update public.applications set status=payload->>'status',submitted_at=case when payload->>'status'='Submitted' then coalesce(submitted_at,now()) else submitted_at end where id=a.id returning * into a;
  result:=jsonb_build_object('request',payload,'application',to_jsonb(a),'source','user-reported-through-agent','confirmed',false);
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload) values(owner_id,a.id,'progress:'||(payload->>'eventKey'),'stage_reported','agent',result);
 else
  if operation='resumes.upload.begin' then
   if payload->>'fileType' not in ('pdf','docx') or (payload->>'sizeBytes')::integer not between 1 and 10485760 or payload->>'sha256' !~ '^[a-f0-9]{64}$' or length(trim(payload->>'name')) not between 1 and 200 or (payload->>'version')::integer<1 then raise exception 'Invalid upload' using errcode='22023'; end if;
   insert into private.resume_upload_intents(id,user_id,metadata) values((payload->>'id')::uuid,owner_id,payload) on conflict(id) do nothing;
  end if;
  select * into intent from private.resume_upload_intents where id=(payload->>'id')::uuid and user_id=owner_id for update;
  if intent.id is null then raise exception 'Owned upload required' using errcode='P0002'; end if;
  if operation='resumes.upload.begin' and intent.metadata is distinct from payload then raise exception 'Upload ID conflict' using errcode='40001'; end if;
  if intent.completed_at is null and intent.created_at<now()-interval '30 minutes' then raise exception 'Upload expired' using errcode='22023'; end if;
  if operation='resumes.upload.finalize' and intent.completed_at is null then
   insert into public.resumes(id,user_id,name,variant,version,object_path,content_hash) values(intent.id,owner_id,intent.metadata->>'name',intent.metadata->>'variant',(intent.metadata->>'version')::integer,owner_id::text||'/'||intent.id::text||'.'||(intent.metadata->>'fileType'),intent.metadata->>'sha256');
   update private.resume_upload_intents set completed_at=now() where id=intent.id returning * into intent;
  end if;
  result:=intent.metadata||jsonb_build_object('objectPath',owner_id::text||'/'||intent.id::text||'.'||(intent.metadata->>'fileType'),'expiresAt',intent.created_at+interval '30 minutes','completed',intent.completed_at is not null,'resume',(select to_jsonb(x) from public.resumes x where id=intent.id and user_id=owner_id));
 end if;
 return result;
end $$;

create function private.extended_actions_for_owner(owner_id uuid,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.company_workspaces; r jsonb; result jsonb;
begin
 if operation='contacts.read' then
  result:=private.company_previous_extended(owner_id,operation,payload);
  return result||(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'user_id',x.user_id,'revision',x.revision,'updated_at',x.updated_at,'record',jsonb_build_object('collection','companies','company',x.name,'followUpDate',coalesce(x.follow_up_date::text,''),'notes',private.company_record(x)::text))),'[]') from public.company_workspaces x where x.user_id=owner_id);
 elsif operation='contacts.save' and (payload#>>'{record,collection}'='companies' or exists(select 1 from public.company_workspaces where user_id=owner_id and id=payload->>'id')) then
  if payload#>>'{record,collection}' is distinct from 'companies' then raise exception 'Company storage changed. Reload required.' using errcode='40001'; end if;
  r:=(payload#>>'{record,notes}')::jsonb;
  result:=private.company_actions(owner_id,'company_workspaces.save',jsonb_build_object('id',payload->>'id','expectedRevision',payload->'expectedRevision','record',r));
  return jsonb_build_object('id',result->'id','revision',result->'revision','record',jsonb_build_object('collection','companies','company',r->>'name','notes',r::text,'followUpDate',r->>'followUpDate'));
 elsif operation='contacts.delete' and exists(select 1 from public.company_workspaces where user_id=owner_id and id=payload->>'id') then
  select * into w from public.company_workspaces where user_id=owner_id and id=payload->>'id';
  return private.company_actions(owner_id,'company_workspaces.save',jsonb_build_object('id',w.id,'expectedRevision',payload->'expectedRevision','record',private.company_record(w)||'{"archived":true}'::jsonb));
 end if;
 return private.company_previous_extended(owner_id,operation,payload);
end $$;
alter function public.agent_dispatch(text,text,jsonb) rename to company_previous_dispatch;
alter function public.company_previous_dispatch(text,text,jsonb) set schema private;
revoke all on function private.company_previous_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections; needed text;
begin
 if operation not in ('companies.list','company_workspaces.list','company_workspaces.save') then return private.company_previous_dispatch(credential_hash,operation,payload); end if;
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid credential' using errcode='28000'; end if;
 needed:=case when operation='company_workspaces.save' then 'network:write' else 'workspace:read' end;
 if not needed=any(c.scopes) then raise exception 'Company scope required' using errcode='42501'; end if;
 return private.company_actions(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
-- Resolve identity at read time. Historical approved revision JSON is immutable.
create function private.company_contexts(content jsonb) returns setof jsonb language sql stable set search_path='' as $$
 select content union all select value from jsonb_array_elements(coalesce(content->'contexts','[]')) where value->>'kind' in ('application','referral') union all select value from jsonb_array_elements(coalesce(content->'offers','[]'))
$$;
alter function private.validate_knowledge_content(jsonb) rename to company_previous_validate_knowledge;
create function private.validate_knowledge_content(content jsonb) returns void language plpgsql set search_path='' as $$
declare cleaned jsonb:=content-'companyId'; part jsonb; field text;
begin
 foreach field in array array['contexts','offers'] loop
  if jsonb_typeof(content->field)='array' then cleaned:=jsonb_set(cleaned,array[field],(select coalesce(jsonb_agg(value-'companyId'),'[]') from jsonb_array_elements(content->field))); end if;
 end loop;
 perform private.company_previous_validate_knowledge(cleaned);
 for part in select * from private.company_contexts(content) loop
  if part ? 'companyId' and (jsonb_typeof(part->'companyId') is distinct from 'string' or private.resolve_company(part->>'company') is distinct from (part->>'companyId')::uuid) then raise exception 'Registered company reference must match context name' using errcode='22023'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(coalesce(content->'contexts','[]')) c where c ? 'companyId' and c->>'kind' not in ('application','referral')) then raise exception 'Company references require company context' using errcode='22023'; end if;
end $$;
alter function private.knowledge_projection(private.knowledge_posts,uuid) rename to company_previous_knowledge_projection;
create function private.knowledge_projection(p private.knowledge_posts, viewer uuid) returns jsonb language sql stable set search_path='' as $$
 select private.company_previous_knowledge_projection(p,viewer)||jsonb_build_object('authorId',p.author_id,'companyContexts',(select coalesce(jsonb_agg(jsonb_build_object('company',c->>'company','companyId',private.resolve_company(c->>'company'),'role',c->>'role','stage',c->>'stage')),'[]') from private.company_contexts((private.company_previous_knowledge_projection(p,viewer))->'content') c where c->>'company' is not null))
$$;
create function private.company_search_projection(p private.knowledge_posts,viewer uuid,published_only boolean) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if published_only then p.current_revision:=p.published_revision; end if;
 return private.knowledge_projection(p,viewer);
end $$;
alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to company_previous_knowledge_action;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare output jsonb; lim integer; q tsquery; across boolean:=coalesce(payload->>'scope'='current_memberships',false); cid uuid; company_id uuid; query_company_id uuid; after_time timestamptz; after_id uuid; after_rank real;
begin
 if op<>'knowledge.search' then return private.company_previous_knowledge_action(actor,op,payload,connection); end if;
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not (select enabled from private.knowledge_config where singleton) then return jsonb_build_object('available',false,'items','[]'::jsonb,'nextCursor',null); end if;
 if jsonb_typeof(payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('circleId','scope','query','company','companyId','authorId','role','type','stage','since','until','sort','cursor','limit')) or payload ? 'company' and payload ? 'companyId' or payload ? 'scope' and not across or across and payload ? 'circleId' then raise exception 'Choose one Circle or current_memberships; choose company ID or name' using errcode='22023'; end if;
 if not across then
  cid:=(payload->>'circleId')::uuid;
  if cid is null or not exists(select 1 from private.circle_members where circle_id=cid and user_id=actor and active) then raise exception 'Circle unavailable' using errcode='42501'; end if;
 end if;
 if payload->>'companyId' is not null then
  company_id:=(payload->>'companyId')::uuid;
  if not exists(select 1 from public.companies where id=company_id) then raise exception 'Unknown company ID' using errcode='22023'; end if;
 elsif payload->>'company' is not null then query_company_id:=private.resolve_company(payload->>'company'); end if;
 if payload->>'sort' is not null and payload->>'sort' not in ('newest','relevance') or length(coalesce(payload->>'query',''))>500 or exists(select 1 from jsonb_each_text(payload) p where p.key in ('company','role','stage','type') and length(p.value)>200) then raise exception 'Invalid search filter' using errcode='22023'; end if;
 lim:=coalesce((payload->>'limit')::int,20);
 if lim not between 1 and 50 then raise exception 'Limit must be 1 to 50' using errcode='22023'; end if;
 q:=websearch_to_tsquery('english',coalesce(payload->>'query',''));
 after_time:=(payload->'cursor'->>'createdAt')::timestamptz; after_id:=(payload->'cursor'->>'id')::uuid; after_rank:=coalesce((payload->'cursor'->>'rank')::real,0);
 if payload ? 'cursor' and (jsonb_typeof(payload->'cursor') is distinct from 'object' or after_time is null or after_id is null or exists(select 1 from jsonb_object_keys(payload->'cursor') k where k not in ('createdAt','id','rank'))) then raise exception 'Invalid search cursor' using errcode='22023'; end if;
 select coalesce(jsonb_agg(item order by score desc,created_at desc,id desc),'[]') into output from (
  select private.company_search_projection(a,actor,across)||jsonb_build_object('circleName',c.name,'rank',case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end) item,a.created_at,a.id,case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end score
  from private.knowledge_posts a join private.circles c on c.id=a.circle_id
  join private.circle_members membership on membership.circle_id=a.circle_id and membership.user_id=actor and membership.active
  join private.knowledge_revisions b on b.post_id=a.id and b.revision=case when not across and a.author_id=actor then a.current_revision else a.published_revision end
  where (across or a.circle_id=cid) and a.parent_id is null
   and (a.state='published' or not across and a.author_id=actor and a.state='draft')
   and (payload->>'authorId' is null or a.author_id=(payload->>'authorId')::uuid)
   and (coalesce(payload->>'query','')='' or b.search_document@@q)
   and (payload->>'type' is null or b.content->>'type'=payload->>'type')
   and (payload->>'since' is null or (b.content->>'experienceDate')::date>=(payload->>'since')::date)
   and (payload->>'until' is null or (b.content->>'experienceDate')::date<=(payload->>'until')::date)
   -- EXISTS keeps each source once; all criteria must match the same context.
   and exists(select 1 from private.company_contexts(b.content) context where
    (company_id is null or private.resolve_company(context->>'company')=company_id)
    and (payload->>'company' is null or case when query_company_id is not null then private.resolve_company(context->>'company')=query_company_id else private.company_key(context->>'company')=private.company_key(payload->>'company') end)
    and (payload->>'role' is null or private.company_key(context->>'role')=private.company_key(payload->>'role'))
    and (payload->>'stage' is null or private.company_key(context->>'stage')=private.company_key(payload->>'stage')))
   and (after_time is null or (case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end,a.created_at,a.id)<(after_rank,after_time,after_id))
  order by score desc,a.created_at desc,a.id desc limit lim
 ) page;
 return jsonb_build_object('items',output,'nextCursor',case when jsonb_array_length(output)=lim then jsonb_build_object('createdAt',output->-1->>'createdAt','id',output->-1->>'id','rank',output->-1->'rank') else null end);
end $$;
-- All privileged internals are callable only through owner/scope checked boundaries.
revoke all on function private.company_key(text),private.resolve_company(text,text),private.company_record(public.company_workspaces),private.company_projection(public.company_workspaces),private.validate_company_record(jsonb),private.company_contexts(jsonb),private.validate_knowledge_content(jsonb),private.company_previous_validate_knowledge(jsonb),private.company_previous_extended(uuid,text,jsonb),private.extended_actions_for_owner(uuid,text,jsonb),private.block_obsolete_company_contact(),private.contact_company_reference(),private.company_previous_knowledge_projection(private.knowledge_posts,uuid),private.knowledge_projection(private.knowledge_posts,uuid),private.company_search_projection(private.knowledge_posts,uuid,boolean),private.company_previous_knowledge_action(uuid,text,jsonb,uuid),private.knowledge_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
commit;
