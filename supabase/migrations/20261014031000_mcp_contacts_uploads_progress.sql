begin;
-- Reuse the existing owner-keyed outreach service and revision trigger.
create table private.resume_upload_intents (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 metadata jsonb not null,created_at timestamptz not null default now(),completed_at timestamptz
);
alter table private.resume_upload_intents enable row level security;
revoke all on private.resume_upload_intents from public,anon,authenticated;
grant all on private.resume_upload_intents to service_role;
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to extended_platform_dispatch_previous;
revoke all on function private.extended_platform_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
create function private.extended_actions_for_owner(owner_id uuid,operation text,payload jsonb)
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
    or exists(select 1 from jsonb_object_keys(payload->'record') k where k not in ('company','contact','name','title','role','contactType','linkedin','email','source','sourceUrl','status','subject','message','notes','followUpDate','jobUrl','employmentType','link','evidence','whyThem','ask','followUp','relationship','location','tags','collection')) then raise exception 'Invalid contact' using errcode='22023'; end if;
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
revoke all on function private.extended_actions_for_owner(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.extended_actions_for_owner(uuid,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections; required_scope text;
begin
 if operation not in ('contacts.read','contacts.save','contacts.delete','resumes.reference.add','applications.progress','resumes.upload.begin','resumes.upload.context','resumes.upload.finalize') then return private.extended_platform_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 required_scope:=case when operation like 'resumes.%' then 'resumes:write' when operation in ('contacts.save','contacts.delete') then 'network:write' when operation='applications.progress' then 'tracking:write' else 'workspace:read' end;
 if not required_scope=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 return private.extended_actions_for_owner(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('workspace:read','profile:write','answers:write','network:write','tracking:write','resumes:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
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

create function public.perform_platform_action(operation text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if operation not in ('profile.save','answers.save','answers.delete','preferences.tiers.save','preferences.notifications.save','preferences.theme.save','preferences.resumes.save','jobs.list','batches.read','batches.item.mark','leaderboard.read','selection.reconsider.simple','human.request','contacts.read','contacts.save','contacts.delete','resumes.reference.add','applications.progress') then raise exception 'Unsupported user action' using errcode='22023'; end if;
 if operation in ('profile.save','answers.save','answers.delete','preferences.tiers.save','preferences.notifications.save','preferences.theme.save','preferences.resumes.save','jobs.list','batches.read','batches.item.mark','leaderboard.read','selection.reconsider.simple','human.request') then return private.platform_actions_for_owner(auth.uid(),operation,payload); end if;
 return private.extended_actions_for_owner(auth.uid(),operation,payload);
end $$;
revoke all on function public.perform_platform_action(text,jsonb) from public,anon;
grant execute on function public.perform_platform_action(text,jsonb) to authenticated;
commit;
