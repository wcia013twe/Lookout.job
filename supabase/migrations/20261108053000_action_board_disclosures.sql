begin;
alter function private.action_board_items(uuid) rename to action_board_items_before_disclosures;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select x||jsonb_build_object(
  'inferences',case when jsonb_typeof(a.draft->'inferences')='array' then a.draft->'inferences' else '[]'::jsonb end,
  'coverLetterSource',a.draft->>'coverLetterSource')
 from private.action_board_items_before_disclosures(owner_id) x
 left join public.applications a on a.id::text=x->>'applicationId' and a.user_id=owner_id
$$;
revoke all on function private.action_board_items(uuid) from public,anon,authenticated;
revoke all on function private.action_board_items_before_disclosures(uuid) from public,anon,authenticated;
commit;
