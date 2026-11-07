-- Include final settings and search-replay guards in the non-retryable domain boundary.
begin;
create or replace function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb
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
  raise exception 'Search lease changed' using errcode='PT409';
 end if;
 perform private.backend_connection(j.user_id,j.connection_id,true);
 perform private.backend_input(j.user_id,j.kind,j.input);
 update private.backend_jobs set lease_expires_at=now()+interval '5 minutes',updated_at=now() where id=j.id returning * into j;
 return jsonb_build_object('leaseExpiresAt',j.lease_expires_at,'version',j.version);
exception when serialization_failure then
 -- Domain conflicts cannot succeed by retrying the same request. Do not use
 -- PostgreSQL's transient serialization code at the PostgREST boundary.
 if sqlerrm = any(array['Backend lease changed','Source changed','Execution run changed','Run changed; reload','Run is closed','Search run is closed','Profile or settings changed','Observed source changed','Request retry changed','Job settings changed before shortlist commit','Retry payload changed','Screening changed','Resume the active sweep for this profile']) then
  raise exception using errcode='PT409',message=sqlerrm;
 end if;
 raise;
end $$;
notify pgrst,'reload schema';
commit;
