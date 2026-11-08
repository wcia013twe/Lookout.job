begin;
-- Read the owner's existing applied/rejected import history alongside native
-- applications. Exact public URLs remain identity hints, not posting evidence.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('public.backend_worker(text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$from public.applications a join public.jobs b on b.id=a.job_id where a.user_id=j.user_id$old$,$new$from public.applications a join public.jobs b on b.id=a.job_id where a.user_id=j.user_id
    union all
    select 'import:'||i.id::text,'url:'||(i.record->>'url'),i.record->>'url',i.record->>'company',i.record->>'title',i.record->>'location',i.record->>'employmentType',null,null,0,true
    from public.imported_jobs i where i.user_id=j.user_id and i.record->>'url' ~ '^https://'
     and (i.record->>'status' in ('APPLIED','SCREEN','INTERVIEW','OFFER','REJECTED') or nullif(i.record->>'appliedDate','') is not null)$new$);
 if changed=definition then raise exception 'Expected owned application history branch unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
