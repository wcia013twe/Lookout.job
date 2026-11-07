begin;
-- Service-only lease renewal. Ownership/version remain unchanged, so concurrent
-- source writes keep the same fence. Expired leases can never be resurrected.
alter function public.backend_worker(text,jsonb) rename to backend_worker_before_search_heartbeat;
alter function public.backend_worker_before_search_heartbeat(text,jsonb) set schema private;
create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;
begin
 if operation is distinct from 'heartbeat' then return private.backend_worker_before_search_heartbeat(operation,payload);end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['jobId','leaseToken','expectedVersion']<>'{}' or not payload ?& array['jobId','leaseToken','expectedVersion']
  or jsonb_typeof(payload->'jobId') is distinct from 'string' or jsonb_typeof(payload->'leaseToken') is distinct from 'string'
  or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]{1,9}$' then
  raise exception 'Closed heartbeat payload required' using errcode='22023';
 end if;
 select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid for update;
 if not found or j.kind<>'search_ats' or j.status<>'running' or j.lease_token is distinct from (payload->>'leaseToken')::uuid
  or j.version is distinct from (payload->>'expectedVersion')::integer or j.lease_expires_at is null or j.lease_expires_at<=now() then
  raise exception 'Search lease changed' using errcode='40001';
 end if;
 perform private.backend_connection(j.user_id,j.connection_id,true);
 perform private.backend_input(j.user_id,j.kind,j.input);
 update private.backend_jobs set lease_expires_at=now()+interval '5 minutes',updated_at=now() where id=j.id returning * into j;
 return jsonb_build_object('leaseExpiresAt',j.lease_expires_at,'version',j.version);
end $$;
revoke all on function public.backend_worker(text,jsonb),private.backend_worker_before_search_heartbeat(text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_worker(text,jsonb) to service_role;
commit;
