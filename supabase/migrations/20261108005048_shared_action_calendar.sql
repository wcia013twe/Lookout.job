-- One owned calendar snapshot for website and scoped MCP planner reads.
alter function private.preparation_planner_read_owned(uuid) rename to preparation_planner_before_calendar;
create function private.preparation_planner_read_owned(owner_id uuid) returns jsonb
language sql security definer set search_path='' as $$
 select private.preparation_planner_before_calendar(owner_id) || jsonb_build_object(
  'imports',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'record',record-array['notes'])),'[]') from public.imported_jobs where user_id=owner_id),
  'calendarArtifacts',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'content',jsonb_build_object('title',content->'title','kind',content->'kind','scheduledAt',content->'scheduledAt','sessionStatus',content->'sessionStatus'))),'[]') from public.career_artifacts where user_id=owner_id and not archived and content->>'kind'='mock_interview'))
$$;
revoke all on function private.preparation_planner_before_calendar(uuid),private.preparation_planner_read_owned(uuid) from public,anon,authenticated;
grant execute on function private.preparation_planner_read_owned(uuid) to service_role;
