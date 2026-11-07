begin;
alter function public.backend_worker(text,jsonb) rename to backend_worker_before_direct_search;
alter function public.backend_worker_before_direct_search(text,jsonb) set schema private;
create function public.backend_worker(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare j private.backend_jobs;args jsonb;response jsonb;v bigint;pv integer;n integer;off integer;lim integer;
begin
 if (operation='dispatch' and payload->>'operation'='search.history.read') or (operation='finish' and payload->'result'->>'pipelineVersion'='2') then
  perform private.backend_worker_before_direct_search('heartbeat',jsonb_build_object('jobId',payload->'jobId','leaseToken',payload->'leaseToken','expectedVersion',payload->'expectedVersion'));
  select * into j from private.backend_jobs where id=(payload->>'jobId')::uuid for update;
  if operation='dispatch' then
   args:=payload->'payload';
   if payload-array['jobId','leaseToken','expectedVersion','operation','payload']<>'{}' or jsonb_typeof(args) is distinct from 'object' or args-array['offset','limit']<>'{}' or not args ?& array['offset','limit'] or coalesce(args->>'offset','') !~ '^[0-9]{1,9}$' or coalesce(args->>'limit','') !~ '^[0-9]{1,3}$' then raise exception 'Closed history page required' using errcode='22023';end if;
   off:=(args->>'offset')::integer;lim:=(args->>'limit')::integer;
   if lim not between 1 and 100 then raise exception 'Bounded history page required' using errcode='22023';end if;
   with history as (
    select l.id::text id,l.identity,l.canonical_url,l.company,l.title,l.location,l.employment_type,l.requisition_id,
     (select md5(o.description) from public.search_observations o where o.user_id=j.user_id and o.listing_id=l.id order by o.checked_at desc,o.created_at desc limit 1) as "contentHash",
     coalesce((select max(s.version) from public.search_screenings s where s.user_id=j.user_id and s.listing_id=l.id),0) as "screeningVersion",false as tracked
    from public.search_listings l where l.user_id=j.user_id
    union all
    select 'application:'||a.id::text,'url:'||b.canonical_url,b.canonical_url,b.employer->>'company',b.employer->>'title',b.employer->>'location',null,null,null,0,true
    from public.applications a join public.jobs b on b.id=a.job_id where a.user_id=j.user_id
   ), page as (select * from history order by id limit lim+1 offset off)
   select jsonb_build_object('listings',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from page order by id limit lim) q),'[]'::jsonb),'nextOffset',case when (select count(*) from page)>lim then off+lim else null end) into response;
   return response;
  end if;
  perform 1 from private.agent_settings_versions where user_id=j.user_id for update;
  select coalesce((select version from private.agent_settings_versions where user_id=j.user_id),1) into v;
  select version into pv from public.search_documents where user_id=j.user_id and kind='profile' and id=j.input->>'profileId' for update;
  if v is distinct from (payload->'result'->'shortlist'->>'personalVersion')::bigint or pv is distinct from (payload->'result'->'shortlist'->>'evaluatedProfileVersion')::integer then raise exception 'Job settings changed before shortlist commit' using errcode='PT409';end if;
  select count(distinct listing_id) into n from public.search_observations where user_id=j.user_id and run_id=j.search_run_id;
  if n is distinct from (payload->'result'->'shortlist'->>'totalRetained')::integer or payload->'result'->'shortlist'->>'runId' is distinct from j.search_run_id::text or jsonb_typeof(payload->'result'->'shortlist'->'retainedListingIds') is distinct from 'array' or jsonb_array_length(payload->'result'->'shortlist'->'retainedListingIds')>100 then raise exception 'Invalid direct shortlist receipt' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'result'->'shortlist'->'retainedListingIds') x where not exists(select 1 from public.search_observations o where o.user_id=j.user_id and o.run_id=j.search_run_id and o.listing_id=x::uuid)) then raise exception 'Shortlist must belong to this run' using errcode='42501';end if;
 end if;
 return private.backend_worker_before_direct_search(operation,payload);
end $$;
revoke all on function public.backend_worker(text,jsonb),private.backend_worker_before_direct_search(text,jsonb) from public,anon,authenticated;
grant execute on function public.backend_worker(text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
