begin;
create function private.update_imported_job_owned(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prior private.tracker_import_events; job public.imported_jobs; v integer; result jsonb; changes jsonb:=payload->'changes'; merged jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['id','expectedVersion','eventKey','changes']<>'{}'
 or not payload ?& array['id','expectedVersion','eventKey','changes']
 or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^\d{1,9}$'
 or coalesce(payload->>'eventKey','') !~ '^[-a-zA-Z0-9_:.]{1,160}$'
 or jsonb_typeof(changes) is distinct from 'object' or changes='{}'::jsonb
 or changes-array['status','statusDate','appliedDate','title','location','notes','archived','archivedDate','employmentType']<>'{}'
 then raise exception 'Invalid imported job update' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':simplify-import',0));
 select * into prior from private.tracker_import_events where user_id=owner_id and event_key=payload->>'eventKey';
 if found then if prior.request is distinct from payload then raise exception 'Import event reused' using errcode='40001';end if;return prior.result;end if;
 select version into v from private.tracker_import_versions where user_id=owner_id;
 if coalesce(v,0)<>(payload->>'expectedVersion')::integer then raise exception 'Tracker changed; read again' using errcode='40001';end if;
 select * into job from public.imported_jobs where user_id=owner_id and id=(payload->>'id')::uuid for update;
 if not found then raise exception 'Imported job not found' using errcode='P0002';end if;
 merged:=job.record||changes;
 -- Reuse the exact row validator used by browser and MCP imports.
 perform private.simplify_import_owned(owner_id,'preview',jsonb_build_object('rows',jsonb_build_array(merged)));
 update public.imported_jobs set record=merged where id=job.id and user_id=owner_id;
 v:=coalesce(v,0)+1;
 insert into private.tracker_import_versions values(owner_id,v) on conflict(user_id) do update set version=excluded.version;
 result:=jsonb_build_object('version',v,'record',jsonb_build_object('id',job.id,'record',merged,'source_rows',job.source_rows),'verifiedSubmission',false);
 insert into private.tracker_import_events values(owner_id,payload->>'eventKey',payload,result);
 return result;
end $$;
revoke all on function private.update_imported_job_owned(uuid,jsonb) from public,anon,authenticated;
create or replace function private.simplify_import_owned(owner_id uuid,action text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; normalized jsonb:='[]'; rec jsonb; group_rows jsonb; decisions jsonb:='[]'; result jsonb; prior private.tracker_import_events;
 v integer:=0; key text; namekey text; saved_id uuid; existing_id text; existing_status text; disposition text; added integer:=0; skipped integer:=0; duplicate_count integer:=0; field text; d text;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;

 if action='update' then return private.update_imported_job_owned(owner_id,payload);end if;
 if action not in ('list','preview','save') or jsonb_typeof(payload) is distinct from 'object'
 or payload - (case when action='list' then array[]::text[] when action='preview' then array['rows'] else array['rows','expectedVersion','eventKey'] end) <> '{}'::jsonb
 then raise exception 'Invalid import request' using errcode='22023'; end if;
 if action='save' then
  if jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^\d{1,9}$' or coalesce(payload->>'eventKey','') !~ '^[-a-zA-Z0-9_:.]{1,160}$' then raise exception 'Import version and event key required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':simplify-import',0));
  select * into prior from private.tracker_import_events where user_id=owner_id and event_key=payload->>'eventKey';
  if found then if prior.request is distinct from payload then raise exception 'Import event reused with different rows' using errcode='40001'; end if;return prior.result;end if;
 end if;
 select version into v from private.tracker_import_versions where user_id=owner_id;v:=coalesce(v,0);
 if action='list' then return jsonb_build_object('version',v,'records',(select coalesce(jsonb_agg(to_jsonb(j)-'user_id'-'identity_key' order by j.created_at,j.id),'[]') from public.imported_jobs j where j.user_id=owner_id));end if;
 if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not between 1 and 500 or octet_length(payload::text)>250000 then raise exception 'Import needs 1-500 bounded rows' using errcode='22023';end if;
 if action='save' and v<>(payload->>'expectedVersion')::integer then raise exception 'Tracker import changed; preview again' using errcode='40001';end if;
 for r in select value from jsonb_array_elements(payload->'rows') loop
  if jsonb_typeof(r) is distinct from 'object' or not r ?& array['company','title','location','url','status','employmentType','appliedDate','statusDate','archived','archivedDate','notes']
   or r-array['company','title','location','url','status','employmentType','appliedDate','statusDate','archived','archivedDate','notes']<>'{}'
   or jsonb_typeof(r->'company') is distinct from 'string' or length(trim(r->>'company')) not between 1 and 300
   or jsonb_typeof(r->'title') is distinct from 'string' or length(trim(r->>'title')) not between 1 and 500
   or jsonb_typeof(r->'location') is distinct from 'string' or length(r->>'location')>500
   or jsonb_typeof(r->'notes') is distinct from 'string' or length(r->>'notes')>10000
   or coalesce(r->>'status','') not in ('SAVED','APPLIED','SCREEN','INTERVIEW','OFFER','REJECTED','WITHDRAWN','CLOSED') or coalesce(r->>'employmentType','') not in ('FT','Internship','Part-time','Contract','Temporary')
   or jsonb_typeof(r->'archived') is distinct from 'boolean'
   or (r->'url'<>'null' and (jsonb_typeof(r->'url') is distinct from 'string' or length(r->>'url')>2048 or r->>'url' !~ '^https?://[^/@[:space:]?#]+([/?#][^[:space:]]*)?$'))
  then raise exception 'Invalid Simplify row' using errcode='22023'; end if;
  foreach field in array array['appliedDate','statusDate','archivedDate'] loop
   d:=r->>field;if d is not null then
    if jsonb_typeof(r->field) is distinct from 'string' or d !~ '^\d{4}-\d{2}-\d{2}$' or to_char(d::date,'YYYY-MM-DD')<>d then raise exception 'Invalid Simplify date' using errcode='22023';end if;
   end if;
  end loop;
  key:=case when r->>'url' is not null then 'url:'||private.import_url(r->>'url') else 'name:'||private.import_name(r->>'company')||':'||private.import_name(r->>'title')||':'||private.import_name(r->>'location') end;
  select value->>'_key' into namekey from jsonb_array_elements(normalized) where (r->>'url' is not null and value->>'url'=private.import_url(r->>'url')) or (private.import_name(value->>'company')=private.import_name(r->>'company') and private.import_name(value->>'title')=private.import_name(r->>'title') and private.import_name(value->>'location')=private.import_name(r->>'location')) limit 1;
  key:=coalesce(namekey,key);
  normalized:=normalized||jsonb_build_array(r||jsonb_build_object('_key',key,'url',private.import_url(r->>'url')));
 end loop;
 for key,group_rows in select value->>'_key',jsonb_agg(value-'_key') from jsonb_array_elements(normalized) group by value->>'_key' loop
  -- Prefer reported process/outcomes over saved/applied; newest dated outcome wins.
  select value into rec from jsonb_array_elements(group_rows) order by (case value->>'status' when 'SAVED' then 0 when 'APPLIED' then 1 else 2 end) desc,value->>'statusDate' desc nulls last limit 1;
  rec:=rec||jsonb_build_object('appliedDate',coalesce(rec->>'appliedDate',(select min(value->>'appliedDate') from jsonb_array_elements(group_rows))));
  rec:=rec||jsonb_build_object('url',coalesce(rec->>'url',(select value->>'url' from jsonb_array_elements(group_rows) where value->>'url' is not null limit 1)));
  rec:=rec||jsonb_build_object('notes',(select coalesce(string_agg(note,E'\n\n' order by note),'') from (select distinct value->>'notes' note from jsonb_array_elements(group_rows) where value->>'notes'<>'') notes));
  namekey:=private.import_name(rec->>'company')||':'||private.import_name(rec->>'title')||':'||private.import_name(rec->>'location');
  existing_id:=null;existing_status:=null;saved_id:=null;disposition:='new';
  select a.id::text,a.status into existing_id,existing_status from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id and (
   (rec->>'url' is not null and private.import_url(j.canonical_url)=rec->>'url') or
   (private.import_name(j.employer->>'company')||':'||private.import_name(j.employer->>'title')||':'||private.import_name(j.employer->>'location')=namekey)
  ) limit 1;
  if existing_id is not null then disposition:='existing application';else
   select j.id,j.record->>'status' into saved_id,existing_status from public.imported_jobs j where j.user_id=owner_id and (j.identity_key=key or
    (private.import_name(j.record->>'company')||':'||private.import_name(j.record->>'title')||':'||private.import_name(j.record->>'location')=namekey)) limit 1;
   if saved_id is not null then disposition:='already imported';end if;
  end if;
  duplicate_count:=duplicate_count+jsonb_array_length(group_rows)-1;
  if disposition='new' then
   added:=added+1;
   if action='save' then
    if (select count(*) from public.imported_jobs where user_id=owner_id)>=5000 then raise exception 'Private import limit reached' using errcode='22023';end if;
    insert into public.imported_jobs(user_id,identity_key,record,source_rows) values(owner_id,key,rec,group_rows) returning id into saved_id;
   end if;
  else skipped:=skipped+1;end if;
  decisions:=decisions||jsonb_build_array(jsonb_build_object('record',rec,'sourceRows',group_rows,'disposition',disposition,'existingStatus',existing_status,'id',coalesce(saved_id::text,existing_id),'duplicateRows',jsonb_array_length(group_rows)-1));
 end loop;
 if action='save' then
  v:=v+1;
  insert into private.tracker_import_versions values(owner_id,v) on conflict(user_id) do update set version=excluded.version;
 end if;
 result:=jsonb_build_object('version',v,'added',added,'skipped',skipped,'duplicateRows',duplicate_count,'decisions',decisions,'source','Simplify CSV','verifiedSubmission',false);
 if action='save' then insert into private.tracker_import_events values(owner_id,payload->>'eventKey',payload,result);end if;
 return result;
end $$;

alter function public.agent_dispatch(text,text,jsonb) rename to application_tracker_previous_dispatch;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql set search_path='' as $$
declare c private.agent_connections;
begin
 if operation='imports.update' then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if c.user_id is null or not 'tracking:write'=any(c.scopes) then raise exception 'Tracking scope required' using errcode='42501';end if;
  return private.simplify_import_owned(c.user_id,'update',payload);
 end if;
 return public.application_tracker_previous_dispatch(credential_hash,operation,payload);
end $$;
revoke all on function public.application_tracker_previous_dispatch(text,text,jsonb),public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
