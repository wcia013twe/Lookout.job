begin;
-- The schedule remains in its existing owned preferences record. Feed rows
-- contain only a pointer/version, never task descriptions or account context.
create function private.emit_muse_schedule_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.search->'schedule') is null or new.search->'schedule'='null'::jsonb then
  if tg_op='INSERT' then return new;end if;
 end if;
 if tg_op='UPDATE' and coalesce(new.search->'schedule','null'::jsonb) is not distinct from coalesce(old.search->'schedule','null'::jsonb) then return new;end if;
 insert into public.activity_events(user_id,event_key,kind,actor,payload)
 values(new.user_id,'muse-feed:schedule:'||gen_random_uuid(),'muse.schedule_changed','system',jsonb_build_object(
  'entity','automation_schedule','recordId',new.user_id,'version',coalesce((new.search#>>'{schedule,configVersion}')::bigint,0),
  'text','My Agent schedule changed. Read the current schedule and reconcile runtime registrations.'));
 return new;
end $$;
revoke all on function private.emit_muse_schedule_change() from public,anon,authenticated;
create trigger muse_schedule_changed after insert or update of search on public.preferences for each row execute function private.emit_muse_schedule_change();

-- Schedule-only edits must not also force a full personal-context refresh.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('private.emit_muse_change()'::regprocedure);
 changed:=replace(replace(definition,$old$new.search-'profiles'$old$,$new$new.search-'profiles'-'schedule'$new$),$old$old.search-'profiles'$old$,$new$old.search-'profiles'-'schedule'$new$);
 if changed=definition then raise exception 'Expected preferences change emitter unavailable';end if;
 execute changed;
end $migration$;

drop index public.muse_changes_pending;
create index muse_changes_pending on public.activity_events(user_id,occurred_at,id)
 where actor='system' and kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed','muse.schedule_changed');

-- Extend the existing read/ack/cleanup and count implementations in place,
-- preserving their credential, ownership, expiry and per-connection receipts.
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.pronargs=3
  and p.prosrc like '%Owned change events required%' and p.prosrc like '%changes.read%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one Muse change-feed implementation';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$'muse.application_timeline_changed'$old$,$new$'muse.application_timeline_changed','muse.schedule_changed'$new$);
 if changed=definition then raise exception 'Expected change-feed event allowlist unavailable';end if;
 execute changed;
 definition:=pg_get_functiondef('public.agent_pending_count(uuid)'::regprocedure);
 changed:=replace(definition,$old$'muse.application_timeline_changed'$old$,$new$'muse.application_timeline_changed','muse.schedule_changed'$new$);
 if changed=definition then raise exception 'Expected pending-count event allowlist unavailable';end if;
 execute changed;
end $migration$;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_schedule_read;
alter function public.agent_dispatch_before_schedule_read(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_schedule_read(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;p public.preferences;
begin
 if operation<>'automation.schedule.read' then return private.agent_dispatch_before_schedule_read(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_schedule_read(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not ('workspace:read'=any(c.scopes)) then raise exception 'Workspace scope required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload<>'{}'::jsonb then raise exception 'Schedule read accepts no arguments' using errcode='22023';end if;
 select * into p from public.preferences where user_id=c.user_id;
 return jsonb_build_object('schedule',p.search->'schedule','configVersion',coalesce((p.search#>>'{schedule,configVersion}')::bigint,0),'updatedAt',p.updated_at,'connectionId',c.id);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
