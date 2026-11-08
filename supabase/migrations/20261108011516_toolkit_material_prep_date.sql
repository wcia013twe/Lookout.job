begin;
-- Preserve all existing owned content checks; only the new optional field is removed
-- before delegation. No grants or ownership rules are widened.
alter function private.validate_artifact_content(uuid,jsonb) rename to validate_artifact_before_prep_date;
create function private.validate_artifact_content(owner_id uuid,doc jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if doc ? 'prepOn' and (jsonb_typeof(doc->'prepOn') is distinct from 'string' or not private.valid_artifact_date(doc->>'prepOn') or doc->>'kind' in ('mock_interview','cover_letter','application_template')) then
  raise exception 'Valid prepOn date on a Toolkit material required' using errcode='22023';
 end if;
 perform private.validate_artifact_before_prep_date(owner_id,doc-'prepOn');
end $$;
revoke all on function private.validate_artifact_before_prep_date(uuid,jsonb),private.validate_artifact_content(uuid,jsonb) from public,anon,authenticated;

alter function private.artifact_weekly_base(uuid,text,jsonb) rename to artifact_before_prep_date;
create function private.artifact_weekly_base(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item_id uuid; off integer; result jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if operation<>'artifacts.list' then return private.artifact_before_prep_date(owner_id,operation,payload);end if;
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
   and (not payload ? 'kind' or content->>'kind'=payload->>'kind') and (not payload ? 'weekOf' or (case when content ? 'prepOn' then to_char(date_trunc('week',(content->>'prepOn')::date),'YYYY-MM-DD') else content->>'weekOf' end)=payload->>'weekOf')
   and (not payload ? 'applicationId' or exists(select 1 from jsonb_array_elements(content->'links') l where (l->>'applicationId')::uuid=(payload->>'applicationId')::uuid))
   and (not payload ? 'goalId' or exists(select 1 from jsonb_array_elements(content->'links') l where (l->>'goalId')::uuid=(payload->>'goalId')::uuid))
   and not exists(select 1 from jsonb_each_text(payload) f where f.key in ('companyWorkspaceId','contactId','jobId') and not exists(select 1 from jsonb_array_elements(content->'links') l where l->>f.key=f.value))
   order by case when payload->>'shelf'='prepared' then content->>'preparedFor' end,updated_at desc,id limit 26 offset off
  ) q;
  return jsonb_build_object('items',case when jsonb_array_length(result)>25 then result-25 else result end,'nextOffset',case when jsonb_array_length(result)>25 then off+25 else null end);

end $$;
revoke all on function private.artifact_before_prep_date(uuid,text,jsonb),private.artifact_weekly_base(uuid,text,jsonb) from public,anon,authenticated;

create or replace function private.preparation_planner_read_owned(owner_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select private.preparation_planner_before_calendar(owner_id) || jsonb_build_object(
  'imports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'record',record-array['notes'])),'[]') from public.imported_jobs where user_id=owner_id),
  'calendarArtifacts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'content',jsonb_build_object('title',content->'title','company',content->'company','kind',content->'kind','prepOn',content->'prepOn','scheduledAt',content->'scheduledAt','sessionStatus',content->'sessionStatus'))),'[]') from public.career_artifacts where user_id=owner_id and not archived and (content->>'kind'='mock_interview' or (content ? 'prepOn' and content->>'kind' not in ('cover_letter','application_template')))))
$$;
revoke all on function private.preparation_planner_read_owned(uuid) from public,anon,authenticated;
grant execute on function private.preparation_planner_read_owned(uuid) to service_role;
commit;
