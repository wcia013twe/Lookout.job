begin;
-- Private, append-only outputs. Tool results are agent observations, never approvals or submission receipts.
create table public.career_toolkit_results (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 application_id uuid references public.applications(id) on delete cascade,
 kind text not null check(kind in ('scan','evaluation','analytics','ats','document','source_config','compensation')),
 event_key text not null check(length(event_key) between 1 and 200), result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<=200000),
 created_at timestamptz not null default now(), unique(user_id,event_key)
);
create index career_toolkit_result_owner_date on public.career_toolkit_results(user_id,created_at desc,id desc);
alter table public.career_toolkit_results enable row level security;
create policy toolkit_result_read on public.career_toolkit_results for select to authenticated using(user_id=(select auth.uid()));
grant select on public.career_toolkit_results to authenticated;
revoke all on public.career_toolkit_results from anon;
grant all on public.career_toolkit_results to service_role;
create table private.career_toolkit_files (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
 application_id uuid references public.applications(id) on delete cascade, event_key text not null,
 kind text not null check(kind in ('resume','cover_letter')),name text not null,variant text not null default 'Master',
 object_path text not null unique,sha256 text not null,bytes integer not null,
 completed_at timestamptz,expires_at timestamptz not null default now()+interval '15 minutes',created_at timestamptz not null default now(),unique(user_id,event_key)
);
alter table private.career_toolkit_files enable row level security;
revoke all on private.career_toolkit_files from public,anon,authenticated;
grant all on private.career_toolkit_files to service_role;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to toolkit_previous;
revoke all on function private.toolkit_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.toolkit_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;r public.career_toolkit_results;f private.career_toolkit_files;aid uuid;rid uuid;outcome jsonb;total integer;
begin
 if operation not like 'toolkit.%' then return private.toolkit_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
 if operation in ('toolkit.record','toolkit.file.begin','toolkit.file.complete','toolkit.file.finalize') and not 'drafts:write'=any(c.scopes) then raise exception 'Drafts scope required' using errcode='42501';end if;
 if operation='toolkit.record' and payload->>'kind'='source_config' and not 'preferences:write'=any(c.scopes) then raise exception 'Preferences scope required' using errcode='42501';end if;
 if payload ? 'applicationId' and payload->>'applicationId' is not null then
  aid:=(payload->>'applicationId')::uuid;
  if not exists(select 1 from public.applications where id=aid and user_id=c.user_id) then raise exception 'Owned application required' using errcode='P0002';end if;
 end if;
 if operation='toolkit.context' then
  select count(*) into total from public.applications where user_id=c.user_id;
  return jsonb_build_object('profile',(select to_jsonb(p) from public.profiles p where user_id=c.user_id),
   'preferences',(select to_jsonb(p) from public.preferences p where user_id=c.user_id),
   'applications',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('job',to_jsonb(j)) order by a.created_at,a.id),'[]') from (select * from public.applications where user_id=c.user_id and (aid is null or id=aid) order by created_at,id limit 5000) a join public.jobs j on j.id=a.job_id),
   'milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from (select * from public.application_milestones where user_id=c.user_id and (aid is null or application_id=aid) order by created_at desc,id desc limit 10000) m),
   'results',(select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at,q.id),'[]') from (select * from public.career_toolkit_results where user_id=c.user_id and (aid is null or application_id=aid) order by created_at desc,id desc limit 1000) q),
   'coverage',jsonb_build_object('totalApplications',total,'applicationLimit',5000,'resultLimit',1000,'milestoneLimit',10000,'partial',total>5000 or (select count(*)>1000 from public.career_toolkit_results where user_id=c.user_id) or (select count(*)>10000 from public.application_milestones where user_id=c.user_id)));
 elsif operation='toolkit.results' then
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc) from (select * from public.career_toolkit_results where user_id=c.user_id and (aid is null or application_id=aid) and (not payload ? 'kind' or kind=payload->>'kind') and (not payload ? 'eventKey' or event_key=payload->>'eventKey') order by created_at desc,id desc limit 100) q),'[]');
 elsif operation='toolkit.record' then
  if coalesce(payload->>'kind','') not in ('scan','evaluation','analytics','ats','document','source_config','compensation') or length(coalesce(payload->>'eventKey','')) not between 1 and 200 or jsonb_typeof(payload->'result') is distinct from 'object' or octet_length((payload->'result')::text)>200000 then raise exception 'Invalid toolkit result' using errcode='22023';end if;
  if payload->>'kind'='evaluation' and (aid is null or jsonb_typeof(payload->'result'->'score') is distinct from 'number' or (payload->'result'->>'score')::numeric not between 1 and 5 or jsonb_typeof(payload->'result'->'requirements') is distinct from 'array') then raise exception 'Scored evaluation requires owned application and requirement evidence' using errcode='22023';end if;
  if payload->>'kind'='source_config' and not exists(select 1 from public.preferences p,jsonb_array_elements(coalesce(p.search->'targets','[]')) t where p.user_id=c.user_id and t->>'id'=payload->'result'->>'targetId') then raise exception 'Saved search target required' using errcode='P0002';end if;
  insert into public.career_toolkit_results(user_id,application_id,kind,event_key,result) values(c.user_id,aid,payload->>'kind',payload->>'eventKey',payload->'result') on conflict(user_id,event_key) do nothing returning * into r;
  if r.id is null then
   select * into r from public.career_toolkit_results where user_id=c.user_id and event_key=payload->>'eventKey';
   if r.application_id is distinct from aid or r.kind<>payload->>'kind' or r.result<>payload->'result' then raise exception 'Retry payload changed' using errcode='40001';end if;
  end if;
  return to_jsonb(r);
 elsif operation='toolkit.file.begin' then
  if length(coalesce(payload->>'eventKey','')) not between 1 and 200 or coalesce(payload->>'kind','') not in ('resume','cover_letter') or coalesce(payload->>'fileName','') !~* '^[^/\\[:cntrl:]]+\.pdf$' or length(payload->>'fileName')>200 or coalesce(payload->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce((payload->>'bytes')::bigint,0) not between 5 and 10485760 or coalesce(payload->>'variant','Master') not in ('Master','Backend','Distributed Systems','ML Infrastructure') then raise exception 'Invalid PDF metadata' using errcode='22023';end if;
  if payload->>'kind'='resume' and not 'profile:write'=any(c.scopes) then raise exception 'Profile scope required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,13));
  select * into f from private.career_toolkit_files where user_id=c.user_id and event_key=payload->>'eventKey';
  if found then
   if f.kind<>payload->>'kind' or f.application_id is distinct from aid or f.name<>payload->>'fileName' or f.sha256<>payload->>'sha256' or f.bytes<>(payload->>'bytes')::integer or f.variant<>coalesce(payload->>'variant','Master') then raise exception 'Retry payload changed' using errcode='40001';end if;
  else
   rid:=gen_random_uuid();
   insert into private.career_toolkit_files(id,user_id,application_id,event_key,kind,name,variant,object_path,sha256,bytes) values(rid,c.user_id,aid,payload->>'eventKey',payload->>'kind',payload->>'fileName',coalesce(payload->>'variant','Master'),c.user_id::text||'/'||rid::text||'.pdf',payload->>'sha256',(payload->>'bytes')::integer) returning * into f;
  end if;
 elsif operation in ('toolkit.file.complete','toolkit.file.finalize','toolkit.file.read') then
  select * into f from private.career_toolkit_files where id=(payload->>'fileId')::uuid and user_id=c.user_id for update;
  if not found then raise exception 'Owned file required' using errcode='P0002';end if;
  if f.kind='resume' and operation<>'toolkit.file.read' and not 'profile:write'=any(c.scopes) then raise exception 'Profile scope required' using errcode='42501';end if;
  if operation='toolkit.file.read' and f.completed_at is null then raise exception 'File incomplete' using errcode='P0002';end if;
  if operation='toolkit.file.finalize' and f.completed_at is null then
   if f.expires_at<now() or not exists(select 1 from storage.objects where bucket_id='resumes' and name=f.object_path) then raise exception 'Upload expired or missing' using errcode='22023';end if;
   perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,13));
   if f.kind='resume' then
    insert into public.resumes(id,user_id,name,variant,version,object_path,content_hash) values(f.id,c.user_id,f.name,f.variant,(select coalesce(max(version),0)+1 from public.resumes where user_id=c.user_id and variant=f.variant),f.object_path,f.sha256);
   end if;
   update private.career_toolkit_files set completed_at=now() where id=f.id returning * into f;
  end if;
 else raise exception 'Unknown toolkit operation' using errcode='22023';end if;
 if f.completed_at is null and f.expires_at<now() then raise exception 'Upload expired; use a fresh event key' using errcode='22023';end if;
 return jsonb_build_object('fileId',f.id,'kind',f.kind,'applicationId',f.application_id,'name',f.name,'objectPath',f.object_path,'sha256',f.sha256,'bytes',f.bytes,'expiresAt',f.expires_at,'completed',f.completed_at is not null,'resumeId',case when f.kind='resume' and f.completed_at is not null then f.id else null end);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
