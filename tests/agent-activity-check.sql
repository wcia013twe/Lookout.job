begin;
alter role service_role bypassrls;
do $$
declare k text:=repeat('e',64);p jsonb;first jsonb;again jsonb;
begin
 perform public.manage_agent_connection('11111111-1111-1111-1111-111111111111','connections.issue',jsonb_build_object('name','Activity fixture','tokenHash',k,'scopes',jsonb_build_array('workspace:read','activity:write')));
 execute 'set local role service_role';
 p:='{"eventKey":"activity-replay","kind":"search_scan","data":{"note":"Fictional observation, not submission evidence."}}';
 first:=public.agent_dispatch(k,'activity.append',p);
 again:=public.agent_dispatch(k,'activity.append',p);
 if first is distinct from again or first->>'actor'<>'agent' or first->>'application_id' is not null then raise exception 'Activity replay or attribution failed';end if;
 execute 'reset role';
 if (select count(*) from public.activity_events where user_id='11111111-1111-1111-1111-111111111111' and event_key='activity-replay')<>1 then raise exception 'Duplicate activity';end if;
 begin perform public.agent_dispatch(k,'activity.append',p||'{"eventKey":"foreign","applicationId":"33333333-3333-3333-3333-333333333333"}');raise exception 'Missing application accepted';exception when no_data_found then null;end;
 execute 'reset role';
end $$;
rollback;
