begin;
-- Extend only the existing leased job dispatcher. No new client privileges,
-- generic dispatcher, table or queue. Identity-only resume pages stay unchanged.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('public.backend_worker(text,jsonb)'::regprocedure);
 changed:=replace(definition,'args jsonb;response jsonb;','args jsonb;scope_args jsonb;response jsonb;');
 changed:=replace(changed,$old$op:=payload->>'operation';args:=payload->'payload';$old$,$new$op:=payload->>'operation';args:=payload->'payload';
  scope_args:=case when op in ('search.screenings.read','search.screenings.commit') then args->'request' else args end;$new$);
 changed:=replace(changed,$old$'search.discoveries.read','search.run.finish')$old$,$new$'search.discoveries.read','search.run.finish','search.screenings.read','search.screenings.commit')$new$);
 changed:=replace(changed,$old$args->>'runId'$old$,$new$scope_args->>'runId'$new$);
 changed:=replace(changed,$old$coalesce(args->>'eventKey','')$old$,$new$coalesce(scope_args->>'eventKey','')$new$);
 changed:=replace(changed,$old$k not in ('runId','offset','limit')$old$,$new$k not in ('runId','offset','limit','purpose')$new$);
 changed:=replace(changed,$old$or not args ?& array['runId','offset','limit']$old$,$new$or (args ? 'purpose' and coalesce(args->>'purpose','')<>'screening')
   or not args ?& array['runId','offset','limit']$new$);
 changed:=replace(changed,$old$if op='search.discoveries.read' then
   -- Return only identity$old$,$new$if op='search.discoveries.read' and args->>'purpose'='screening' then
   response:=jsonb_build_object('listings',coalesce((select jsonb_agg(jsonb_build_object(
    'id',x->'id','canonical_url',x->'canonical_url','company',x->'company','title',x->'title','location',x->'location',
    'identity',x->'identity','requisition_id',x->'requisition_id','employment_type',x->'employment_type',
    'screeningVersion',x->'screeningVersion','observation',jsonb_build_object('id',x->'observation'->'id',
    'description',x->'observation'->'description','employer_posted_at',x->'observation'->'employer_posted_at')
   )) from jsonb_array_elements(response->'listings') x),'[]'::jsonb),'nextOffset',response->'nextOffset');
  elsif op='search.discoveries.read' then
   -- Return only identity$new$);
 changed:=replace(changed,'scope_args jsonb;response jsonb;','scope_args jsonb;response jsonb;v bigint;pv integer;');
 changed:=replace(changed,$old$  perform private.backend_connection(j.user_id,j.connection_id,true);
  if payload->>'status' in ('failed','partial')$old$,$new$  perform private.backend_connection(j.user_id,j.connection_id,true);
  if payload->'result'->>'pipelineVersion'='1' and payload->>'status' in ('completed','partial') then
   perform 1 from private.agent_settings_versions where user_id=j.user_id for update;
   select coalesce((select version from private.agent_settings_versions where user_id=j.user_id),1) into v;
   select version into pv from public.search_documents where user_id=j.user_id and kind='profile' and id=j.input->>'profileId' for update;
   if v is distinct from (payload->'result'->'shortlist'->>'personalVersion')::bigint or pv is distinct from (payload->'result'->'shortlist'->>'evaluatedProfileVersion')::integer then raise exception 'Job settings changed before shortlist commit' using errcode='40001';end if;
   if jsonb_typeof(payload->'result'->'shortlist'->'retainedListingIds') is distinct from 'array' or jsonb_array_length(payload->'result'->'shortlist'->'retainedListingIds')>250 then raise exception 'Bounded job shortlist required' using errcode='22023';end if;
   if exists(select 1 from jsonb_array_elements_text(payload->'result'->'shortlist'->'retainedListingIds') x where not exists(select 1 from public.search_observations z where z.user_id=j.user_id and z.run_id=j.search_run_id and z.listing_id=x::uuid)) then raise exception 'Job shortlist must belong to its run' using errcode='42501';end if;
  end if;
  if payload->>'status' in ('failed','partial')$new$);
 if changed=definition or position('scope_args jsonb' in changed)=0 or position('and args->>''purpose''=''screening''' in changed)=0 or position('Job settings changed before shortlist commit' in changed)=0 then raise exception 'Expected fenced worker definition unavailable';end if;
 execute changed;
end $migration$;
commit;
