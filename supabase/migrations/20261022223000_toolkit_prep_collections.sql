-- Ordered, owned saved revisions and explicit upcoming preparation shelves.
begin;
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
 for item in select value from jsonb_array_elements(doc->'links') loop
  if jsonb_typeof(item) is distinct from 'object' or item-array['applicationId','goalId','taskId']<>'{}' or (item ? 'applicationId')=(item ? 'goalId') or jsonb_typeof(item->'taskId') is distinct from 'string' or length(trim(item->>'taskId')) not between 1 and 200 then raise exception 'Invalid task link' using errcode='22023';end if;
  parent_id:=coalesce(item->>'applicationId',item->>'goalId')::uuid;
  if item ? 'applicationId' then
   if not exists(select 1 from public.preparation_plans p,jsonb_array_elements(p.plan->'tasks') t where p.user_id=owner_id and p.application_id=parent_id and t->>'id'=item->>'taskId') then raise exception 'Owned interview task required' using errcode='P0002';end if;
  else
   if not exists(select 1 from public.learning_goals g,jsonb_array_elements(g.goal->'tasks') t where g.user_id=owner_id and g.id=parent_id and t->>'id'=item->>'taskId') then raise exception 'Owned learning task required' using errcode='P0002';end if;
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(doc->'links'))<>(select count(distinct (coalesce(value->>'applicationId',value->>'goalId'),value->>'taskId')) from jsonb_array_elements(doc->'links')) then raise exception 'Duplicate task links' using errcode='22023';end if;
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
  if payload-array['query','kind','weekOf','applicationId','goalId','archived','offset','shelf','asOf']<>'{}' or (payload ? 'query' and (jsonb_typeof(payload->'query') is distinct from 'string' or length(payload->>'query')>200)) or (payload ? 'archived' and jsonb_typeof(payload->'archived') is distinct from 'boolean') or (payload ? 'offset' and (jsonb_typeof(payload->'offset') is distinct from 'number' or payload->>'offset' !~ '^[0-9]+$')) or (payload ? 'weekOf' and not private.valid_artifact_date(payload->>'weekOf')) then raise exception 'Invalid artifact filters' using errcode='22023';end if;
  if payload ? 'shelf' and (jsonb_typeof(payload->'shelf') is distinct from 'string' or payload->>'shelf' not in ('prepared','saved','all')) or payload ? 'asOf' and (not payload ? 'shelf' or jsonb_typeof(payload->'asOf') is distinct from 'string' or not private.valid_artifact_date(payload->>'asOf')) then raise exception 'Valid shelf and local date required' using errcode='22023';end if;
  if payload ? 'kind' and coalesce(payload->>'kind','') not in ('weekly_prep','company_research','interview_brief','read_up','explainer','practice','decision_aid','notes','cover_letter','application_template') then raise exception 'Unknown artifact kind' using errcode='22023';end if;
  if payload ? 'applicationId' then item_id:=(payload->>'applicationId')::uuid;end if;
  if payload ? 'goalId' then item_id:=(payload->>'goalId')::uuid;end if;
  off:=coalesce((payload->>'offset')::integer,0);if off not between 0 and 100000 then raise exception 'Invalid page' using errcode='22023';end if;
  select coalesce(jsonb_agg(q.item order by case when payload->>'shelf'='prepared' then q.item->'content'->>'preparedFor' end,q.updated_at desc,q.id),'[]') into result from (
   select (private.artifact_response(a)-'content')||jsonb_build_object('content',content-'body') as item,updated_at,id
   from public.career_artifacts a where user_id=owner_id and archived=coalesce((payload->>'archived')::boolean,false)
   and (not payload ? 'shelf' or (content->>'kind' not in ('cover_letter','application_template') and (payload->>'shelf'='all' or (coalesce(content->>'kind' in ('weekly_prep','interview_brief') and private.valid_artifact_date(content->>'preparedFor') and content->>'preparedFor'>=coalesce(payload->>'asOf',current_date::text),false))=(payload->>'shelf'='prepared'))))
   and (not payload ? 'query' or position(lower(payload->>'query') in lower((content->>'title')||' '||(content->>'purpose')||' '||coalesce(content->>'company','')||' '||(content->>'body')))>0)
   and (not payload ? 'kind' or content->>'kind'=payload->>'kind') and (not payload ? 'weekOf' or content->>'weekOf'=payload->>'weekOf')
   and (not payload ? 'applicationId' or exists(select 1 from jsonb_array_elements(content->'links') l where l->>'applicationId'=payload->>'applicationId'))
   and (not payload ? 'goalId' or exists(select 1 from jsonb_array_elements(content->'links') l where l->>'goalId'=payload->>'goalId'))
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
