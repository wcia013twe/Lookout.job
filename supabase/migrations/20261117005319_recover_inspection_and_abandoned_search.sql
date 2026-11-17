begin;
-- Reuse the existing finalizer's observation; answer approval stays human-owned.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('public.backend_job_dispatch(text,text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$draft:=payload->'finalDraft';$old$,$new$draft:=jsonb_set(payload->'finalDraft','{inspectionComplete}',payload->'browserInspected');$new$);
 if changed=definition then raise exception 'Application inspection patch unavailable';end if;
 execute changed;
 -- Run starts already hold the per-owner search lock. Only orphaned,
 -- idle sweeps may close; queued/running backend jobs retain their checkpoints
 -- and the existing lease/retry mechanism remains responsible for them.
 definition:=pg_get_functiondef('private.search_owned(uuid,text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$ elsif operation='search.run.start' then$old$,$new$ elsif operation='search.run.start' then
  update public.search_runs stale_run set state='partial',version=stale_run.version+1,finished_at=now(),
   summary='Idle unowned sweep closed automatically; saved observations and source checkpoints retained.'
  where stale_run.user_id=owner_id and stale_run.profile_id=payload->>'profileId' and stale_run.state='active'
   and stale_run.created_at<now()-interval '15 minutes'
   and not exists(select 1 from public.search_source_attempts idle_source where idle_source.user_id=owner_id and idle_source.run_id=stale_run.id and idle_source.updated_at>=now()-interval '15 minutes')
   and not exists(select 1 from private.backend_jobs j where j.user_id=owner_id and j.search_run_id=stale_run.id and j.status in ('queued','running'));
$new$);
 if changed=definition then raise exception 'Abandoned search patch unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
