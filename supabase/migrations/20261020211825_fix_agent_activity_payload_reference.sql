-- The activity table also has a payload column. Qualify the function argument
-- in its replay read so PostgreSQL cannot mistake it for that table column.
do $$
declare definition text; old_statement text := 'from public.activity_events e where user_id=c.user_id and event_key=payload->>''eventKey''';
begin
 definition:=pg_get_functiondef('private.agent_dispatch_core(text,text,jsonb)'::regprocedure);
 if position(old_statement in definition)>0 then
  definition:=replace(definition,old_statement,'from public.activity_events e where e.user_id=c.user_id and e.event_key=agent_dispatch_core.payload->>''eventKey''');
  execute definition;
 elsif position('e.event_key=agent_dispatch_core.payload' in definition)=0 then
  raise exception 'Unexpected activity implementation; review before changing it';
 end if;
end $$;
