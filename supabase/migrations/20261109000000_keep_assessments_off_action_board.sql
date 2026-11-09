begin;
-- The Action Board is for Muse approvals and blockers. Candidate assessments
-- and scheduled round confirmations remain on their application records.
create function private.is_assessment_action(value text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(value,'') ~* '(^|[^[:alnum:]])(oa|online[ -]+assessment|coding[ -]+assessment|technical[ -]+assessment|take[ -]?home([ -]+assessment)?)([^[:alnum:]]|$)'
$$;
revoke all on function private.is_assessment_action(text) from public,anon,authenticated;

alter function private.action_board_items(uuid) rename to action_board_items_before_assessment_filter;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select item from private.action_board_items_before_assessment_filter(owner_id) item
 where item->>'kind'<>'confirm_interview'
 and not (item->>'kind'='imported_action' and private.is_assessment_action(item->>'reason'))
$$;
revoke all on function private.action_board_items(uuid),private.action_board_items_before_assessment_filter(uuid) from public,anon,authenticated;

alter function private.action_board_read(uuid) rename to action_board_read_before_assessment_filter;
create function private.action_board_read(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with current_board as (select private.action_board_read_before_assessment_filter(owner_id) as data)
 select data||jsonb_build_object(
   'items',coalesce((select jsonb_agg(item order by item->>'createdAt',item->>'key')
     from jsonb_array_elements(coalesce(data->'items','[]'::jsonb)) item
     where item->>'kind'<>'confirm_interview'
       and not (item->>'kind'='imported_action' and private.is_assessment_action(item->>'reason'))),'[]'::jsonb),
   'trackerWork',coalesce((select jsonb_agg(work order by work->>'respondedAt')
     from jsonb_array_elements(coalesce(data->'trackerWork','[]'::jsonb)) work
     where not private.is_assessment_action(work->>'action')),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(entry order by entry->>'responded_at' desc)
     from jsonb_array_elements(coalesce(data->'history','[]'::jsonb)) entry
     where entry->>'source_kind'<>'confirm_interview'
       and not (entry->>'source_kind'='imported_action' and private.is_assessment_action(entry#>>'{source_summary,action}'))),'[]'::jsonb)
 ) from current_board
$$;
revoke all on function private.action_board_read(uuid),private.action_board_read_before_assessment_filter(uuid) from public,anon,authenticated;
commit;
