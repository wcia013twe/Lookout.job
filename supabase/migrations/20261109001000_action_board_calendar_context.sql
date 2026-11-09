begin;
-- Assessment deadlines and scheduled interview descriptions belong in the
-- application calendar/tracker, not in Muse's approval queue.
create function private.is_calendar_context_action(value text) returns boolean
language sql immutable set search_path='' as $$
 select private.is_assessment_action(value)
   or coalesce(value,'') ~* '(^|[^[:alnum:]])(hackerrank|hirevue|codesignal|codility)([^[:alnum:]]|$)'
   or (coalesce(value,'') ~* '(^|[^[:alnum:]])(interview|screen|onsite|on-site)([^[:alnum:]]|$)'
       and coalesce(value,'') ~* '(^|[^[:alnum:]])(with|scheduled|confirmed|on|at|round|google[ -]+meet|zoom|teams|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|[0-9]{1,2}:[0-9]{2}|[0-9]{1,2}[[:space:]]*(am|pm))([^[:alnum:]]|$)')
$$;
revoke all on function private.is_calendar_context_action(text) from public,anon,authenticated;

alter function private.action_board_items(uuid) rename to action_board_items_before_calendar_context;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select item from private.action_board_items_before_calendar_context(owner_id) item
 where item->>'kind'<>'confirm_interview'
   and not (item->>'kind'='imported_action' and private.is_calendar_context_action(item->>'reason'))
$$;
revoke all on function private.action_board_items(uuid),private.action_board_items_before_calendar_context(uuid) from public,anon,authenticated;

alter function private.action_board_read(uuid) rename to action_board_read_before_calendar_context;
create function private.action_board_read(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with current_board as (select private.action_board_read_before_calendar_context(owner_id) as data)
 select data||jsonb_build_object(
   'items',coalesce((select jsonb_agg(item order by item->>'createdAt',item->>'key')
     from jsonb_array_elements(coalesce(data->'items','[]'::jsonb)) item
     where item->>'kind'<>'confirm_interview'
       and not (item->>'kind'='imported_action' and private.is_calendar_context_action(item->>'reason'))),'[]'::jsonb),
   'trackerWork',coalesce((select jsonb_agg(work order by work->>'respondedAt')
     from jsonb_array_elements(coalesce(data->'trackerWork','[]'::jsonb)) work
     where not private.is_calendar_context_action(work->>'action')),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(entry order by entry->>'responded_at' desc)
     from jsonb_array_elements(coalesce(data->'history','[]'::jsonb)) entry
     where entry->>'source_kind'<>'confirm_interview'
       and not (entry->>'source_kind'='imported_action' and private.is_calendar_context_action(entry#>>'{source_summary,action}'))),'[]'::jsonb)
 ) from current_board
$$;
revoke all on function private.action_board_read(uuid),private.action_board_read_before_calendar_context(uuid) from public,anon,authenticated;
commit;
