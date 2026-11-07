begin;
create or replace function private.validate_artifact_content(owner_id uuid,doc jsonb) returns void language plpgsql set search_path='' as $$
declare item jsonb; parent_id uuid;
begin
 if jsonb_typeof(doc) is distinct from 'object' or doc-array['title','purpose','kind','format','body','weekOf','company','sources','links','materials','preparedFor','resourceUrl','scheduledAt','timeZone','durationMinutes','sessionStatus','debriefId']<>'{}'
  or jsonb_typeof(doc->'title') is distinct from 'string' or length(trim(doc->>'title')) not between 1 and 200
  or jsonb_typeof(doc->'purpose') is distinct from 'string' or length(trim(doc->>'purpose')) not between 1 and 1000
  or jsonb_typeof(doc->'body') is distinct from 'string' or length(trim(doc->>'body')) not between 1 and 150000
  or coalesce(doc->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes','cover_letter','application_template','story_bank','interview_debrief','resource','mock_interview')
  or coalesce(doc->>'format','') not in ('markdown','html')
  or jsonb_typeof(doc->'sources') is distinct from 'array' or jsonb_array_length(doc->'sources')>30
  or jsonb_typeof(doc->'links') is distinct from 'array' or jsonb_array_length(doc->'links')>50
  or (doc ? 'weekOf' and (jsonb_typeof(doc->'weekOf') is distinct from 'string' or not private.valid_artifact_date(doc->>'weekOf')))
  or (doc ? 'company' and (jsonb_typeof(doc->'company') is distinct from 'string' or length(doc->>'company')>200))
 then raise exception 'Invalid artifact content' using errcode='22023';end if;

 if doc->>'kind'='resource' then
  if jsonb_typeof(doc->'resourceUrl') is distinct from 'string' or not private.valid_artifact_source(doc->>'resourceUrl') then raise exception 'Public HTTPS resource required' using errcode='22023';end if;
 elsif doc ? 'resourceUrl' then raise exception 'Resource kind required' using errcode='22023';end if;
 if doc->>'kind'='mock_interview' then
  if jsonb_typeof(doc->'scheduledAt') is distinct from 'string' or doc->>'scheduledAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$'
   or not isfinite((doc->>'scheduledAt')::timestamptz) or not exists(select 1 from pg_timezone_names where name=doc->>'timeZone')
   or jsonb_typeof(doc->'durationMinutes') is distinct from 'number' or doc->>'durationMinutes' !~ '^[0-9]+$' or (doc->>'durationMinutes')::integer not between 5 and 180
   or coalesce(doc->>'sessionStatus','') not in ('scheduled','in_progress','completed','cancelled')
   or doc->>'weekOf' is distinct from to_char(date_trunc('week',(doc->>'scheduledAt')::timestamptz at time zone (doc->>'timeZone')),'YYYY-MM-DD')
   then raise exception 'Dated mock session in its local week required' using errcode='22023';end if;
  if doc ? 'debriefId' and not exists(select 1 from public.career_artifacts where id=(doc->>'debriefId')::uuid and user_id=owner_id and content->>'kind'='interview_debrief') then raise exception 'Owned interview debrief required' using errcode='P0002';end if;
 elsif doc ?| array['scheduledAt','timeZone','durationMinutes','sessionStatus','debriefId'] then raise exception 'Mock kind required' using errcode='22023';end if;
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

create or replace function private.artifact_weekly_base(owner_id uuid,operation text,payload jsonb) returns jsonb
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
  if payload ? 'kind' and coalesce(payload->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes','cover_letter','application_template','story_bank','interview_debrief','resource','mock_interview') then raise exception 'Unknown artifact kind' using errcode='22023';end if;
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
revoke all on function private.artifact_weekly_base(uuid,text,jsonb) from public,anon,authenticated;
create table private.mock_interview_profiles(
 artifact_id uuid primary key references public.career_artifacts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 interviewer_profile text not null check(length(trim(interviewer_profile)) between 1 and 30000)
);
alter table private.mock_interview_profiles enable row level security;
revoke all on private.mock_interview_profiles from public,anon,authenticated,service_role;
create trigger workspace_reset_guard before insert or update or delete on private.mock_interview_profiles for each row execute function private.workspace_reset_write_guard();

create or replace function private.artifact_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if operation='artifacts.save' and (payload->>'kind'='mock_interview' or exists(select 1 from public.career_artifacts where id=(payload->>'id')::uuid and user_id=owner_id and content->>'kind'='mock_interview')) then
  raise exception 'Use save_mock_interview through your connected agent' using errcode='42501';
 end if;
 return private.artifact_weekly_base(owner_id,operation,payload);
end $$;

create function private.mock_interview_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb; result jsonb; previous public.career_artifacts; profile text; session_id uuid; expected integer;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Object required' using errcode='22023';end if;
 if operation='mock.read' then
  if payload-array['id']<>'{}' then raise exception 'Unknown argument' using errcode='22023';end if;
  result:=private.artifact_weekly_base(owner_id,'artifacts.read',payload);
  select interviewer_profile into profile from private.mock_interview_profiles where artifact_id=(payload->>'id')::uuid and user_id=owner_id;
  if profile is null then raise exception 'Owned mock interview required' using errcode='P0002';end if;
  return jsonb_build_object('artifact',result,'interviewerProfile',profile);
 end if;
 if operation<>'mock.save' or payload-array['artifact','interviewerProfile']<>'{}' or jsonb_typeof(payload->'artifact') is distinct from 'object' or jsonb_typeof(payload->'interviewerProfile') is distinct from 'string' or length(trim(payload->>'interviewerProfile')) not between 1 and 30000 then raise exception 'Mock artifact and interviewer profile required' using errcode='22023';end if;
 a:=payload->'artifact';session_id:=(a->>'id')::uuid;expected:=(a->>'expectedVersion')::integer;
 if a->>'kind' is distinct from 'mock_interview' then raise exception 'Mock kind required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(session_id::text,82));
 select * into previous from public.career_artifacts where id=session_id for update;
 if previous.id is not null and (previous.user_id<>owner_id or previous.content->>'kind'<>'mock_interview') then raise exception 'Owned mock interview required' using errcode='P0002';end if;
 select interviewer_profile into profile from private.mock_interview_profiles where artifact_id=session_id and user_id=owner_id;
 if previous.version=expected+1 and previous.content=a-array['id','expectedVersion'] then
  if profile is distinct from payload->>'interviewerProfile' then raise exception 'Retry profile changed' using errcode='40001';end if;
  return jsonb_build_object('artifact',private.artifact_response(previous));
 end if;
 if previous.id is not null and previous.version<>expected then raise exception 'Mock changed; reload' using errcode='40001';end if;
 if previous.id is null and a->>'sessionStatus'<>'scheduled' then raise exception 'New mocks start scheduled' using errcode='22023';end if;
 if previous.archived then raise exception 'Restore archived session first' using errcode='22023';end if;
 if previous.content->>'sessionStatus' in ('completed','cancelled') and a->>'sessionStatus' is distinct from previous.content->>'sessionStatus' then raise exception 'Create a new session after a terminal mock' using errcode='22023';end if;
 if previous.content->>'sessionStatus'='in_progress' and a->>'sessionStatus'='scheduled' then raise exception 'Resume the existing session' using errcode='22023';end if;
 if a->>'sessionStatus'='completed' and (previous.content->>'sessionStatus' is distinct from 'in_progress' or not a ? 'debriefId') then raise exception 'Complete an active mock with a saved debrief' using errcode='22023';end if;
 result:=private.artifact_weekly_base(owner_id,'artifacts.save',a);
 insert into private.mock_interview_profiles(artifact_id,user_id,interviewer_profile) values(session_id,owner_id,payload->>'interviewerProfile')
 on conflict(artifact_id) do update set interviewer_profile=excluded.interviewer_profile;
 return jsonb_build_object('artifact',result);
end $$;
revoke all on function private.mock_interview_owned(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.mock_interview_owned(uuid,text,jsonb) to service_role;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_weekly_toolkit;
alter function public.agent_dispatch_before_weekly_toolkit(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_weekly_toolkit(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 if operation not in ('mock.read','mock.save') then return private.agent_dispatch_before_weekly_toolkit(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'workspace:read'=any(c.scopes) or (operation='mock.save' and not 'drafts:write'=any(c.scopes)) then raise exception 'Mock interview scope required' using errcode='42501';end if;
 return private.mock_interview_owned(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
