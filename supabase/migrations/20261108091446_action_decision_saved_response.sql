begin;
-- The validated human request is already durable in the decision ledger. Attach
-- that exact request after insertion (or the inline writer's final update), in
-- the same transaction as its existing notification. Never derive it from prose.
create function private.attach_action_decision_response(owner_id uuid,request jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare response text:=request->>'response';key text:=request->>'key';
begin
 if key is null or response not in ('accept','reject','resume_tracker','stop_tracker') or response is null then return;end if;
 response:=case response when 'resume_tracker' then 'resume' when 'stop_tracker' then 'reject' else response end;
 update public.activity_events e set payload=e.payload||jsonb_build_object('savedResponse',request)
 where e.user_id=owner_id and e.actor='system' and e.kind='muse.action_decision'
 and e.event_key='muse-feed:decision:'||md5(key)||':'||response
 and e.payload->>'decisionKey'=key and e.payload->>'response'=response;
end $$;
revoke all on function private.attach_action_decision_response(uuid,jsonb) from public,anon,authenticated;
create function private.emit_saved_action_response() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private.attach_action_decision_response(new.user_id,new.request);
 return new;
end $$;
revoke all on function private.emit_saved_action_response() from public,anon,authenticated;
create trigger action_decision_saved_response after insert or update of request on private.action_response_events
for each row execute function private.emit_saved_action_response();
-- Historical notifications get their saved body without deleting receipts,
-- changing consent, creating work, or replaying already acknowledged decisions.
do $$ declare r record;begin
 for r in select user_id,request from private.action_response_events where request?'key' and request?'response' loop
  perform private.attach_action_decision_response(r.user_id,r.request);
 end loop;
end $$;
-- Preserve the existing owned authentication, paging, kind allowlist and receipts.
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.pronargs=3 and p.prosrc like '%Owned change events required%' and p.prosrc like '%changes.read%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one Muse feed implementation';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$'summary',e.payload->'text'$old$,$new$'summary',e.payload->'text','savedResponse',case when e.kind='muse.action_decision' then e.payload->'savedResponse' end$new$);
 if changed=definition then raise exception 'Expected feed projection unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
