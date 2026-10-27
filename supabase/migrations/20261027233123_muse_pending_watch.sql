begin;
alter table private.agent_connections add column muse_watch_id uuid unique;
-- Service-only aggregate. The public HTTP handler exposes only the scalar.
create function public.muse_pending_count(watch_id uuid) returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from public.activity_events e
 join private.agent_connections c on c.user_id=e.user_id
 where c.muse_watch_id=watch_id and c.revoked_at is null and c.expires_at>now()
 and array['workspace:read','activity:write']::text[]<@c.scopes
 and e.actor='system' and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed')
 and not exists(select 1 from private.muse_change_receipts r where r.connection_id=c.id and r.event_id=e.id);
$$;
revoke all on function public.muse_pending_count(uuid) from public,anon,authenticated;
grant execute on function public.muse_pending_count(uuid) to service_role;
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_muse_watch;
alter function public.agent_dispatch_before_muse_watch(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_muse_watch(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;handle uuid;
begin
 if operation<>'changes.watch' then return private.agent_dispatch_before_muse_watch(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_muse_watch(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash for update;
 if not array['workspace:read','activity:write']::text[]<@c.scopes then raise exception 'Scope required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or jsonb_typeof(payload->'enabled') is distinct from 'boolean' or exists(select 1 from jsonb_object_keys(payload) k where k<>'enabled') then raise exception 'Boolean enabled required' using errcode='22023';end if;
 handle:=case when (payload->>'enabled')::boolean then gen_random_uuid() else null end;
 update private.agent_connections set muse_watch_id=handle where id=c.id;
 return jsonb_build_object('watchId',handle,'enabled',handle is not null,'pollIntervalSeconds',120);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
