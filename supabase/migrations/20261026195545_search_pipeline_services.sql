-- Internal service orchestration only. Public MCP accepts narrow validated requests;
-- current credentials, ownership and versions are still enforced inside SQL.
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_search_pipeline;
alter function public.agent_dispatch_before_search_pipeline(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_search_pipeline(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.agent_dispatch_before_search_pipeline(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;r public.search_runs;old private.search_requests;req jsonb;key text;family text;response jsonb;part jsonb;item jsonb;items jsonb:='[]';v bigint;pv integer;idx integer:=0;o public.search_observations;
begin
 if operation not in ('search.leads.read','search.leads.commit','search.screenings.read','search.screenings.commit') then return private.agent_dispatch_before_search_pipeline(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_search_pipeline(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not ('workspace:read'=any(c.scopes) and 'drafts:write'=any(c.scopes)) then raise exception 'Workspace and draft scopes required' using errcode='42501';end if;
 req:=payload->'request';
 if jsonb_typeof(req) is distinct from 'object' or coalesce(req->>'eventKey','') !~ '^[a-zA-Z0-9_:.-]{1,160}$' or octet_length(payload::text)>2000000 then raise exception 'Invalid pipeline request' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,71));
 select * into r from public.search_runs where user_id=c.user_id and id=(req->>'runId')::uuid for update;
 if not found then raise exception 'Owned search run required' using errcode='P0002';end if;
 family:=case when operation like 'search.leads.%' then 'leads' else 'screenings' end;
 if family='leads' then
  if jsonb_typeof(req->'leads') is distinct from 'array' or jsonb_array_length(req->'leads') not between 1 and 25 or not exists(select 1 from public.search_source_attempts where user_id=c.user_id and run_id=r.id and source_id=req->>'sourceId') then raise exception 'Source must belong to owned run with 1-25 leads' using errcode='22023';end if;
 else
  if jsonb_typeof(req->'listingIds') is distinct from 'array' or jsonb_array_length(req->'listingIds') not between 1 and 25 or (select count(distinct x) from jsonb_array_elements_text(req->'listingIds') x)<>jsonb_array_length(req->'listingIds') then raise exception 'Invalid bounded screening IDs' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements_text(req->'listingIds') x where not exists(select 1 from public.search_observations z where z.user_id=c.user_id and z.run_id=r.id and z.listing_id=x::uuid)) then raise exception 'Owned observed discoveries required' using errcode='P0002';end if;
 end if;
 key:='pipeline:'||family||':'||md5(req->>'eventKey');
 select * into old from private.search_requests where user_id=c.user_id and event_key=key;
 if found then if old.payload<>req or old.operation<>family then raise exception 'Request retry changed' using errcode='40001';end if;return old.response;end if;
 if operation like '%.read' then return null;end if;
 if family='leads' then
  if r.state<>'active' then raise exception 'Search run is closed' using errcode='40001';end if;
  if jsonb_typeof(payload->'observations') is distinct from 'array' or jsonb_array_length(payload->'observations')>jsonb_array_length(req->'leads') or jsonb_typeof(payload->'diagnostics') is distinct from 'array' or jsonb_array_length(payload->'diagnostics')>25 then raise exception 'Invalid source observations or diagnostics' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(payload->'observations') loop
   if item->>'sourceId' is distinct from req->>'sourceId' then raise exception 'Source identity mismatch' using errcode='22023';end if;
   part:=private.search_owned(c.user_id,'search.discoveries.save',jsonb_build_object('runId',r.id,'listings',jsonb_build_array(item),'eventKey',key||':'||idx));items:=items||(part->'saved');idx:=idx+1;
  end loop;
  response:=jsonb_build_object('runId',r.id,'saved',items,'diagnostics',payload->'diagnostics','counts',jsonb_build_object('submitted',jsonb_array_length(req->'leads'),'verified',idx),'status',case when idx=jsonb_array_length(req->'leads') then 'verified' else 'partial' end);
 else
  perform 1 from private.agent_settings_versions where user_id=c.user_id for update;
  select coalesce(version,1) into v from private.agent_settings_versions where user_id=c.user_id;
  select version into pv from public.search_documents where user_id=c.user_id and kind='profile' and id=r.profile_id for update;
  if coalesce(v,1) is distinct from (payload->>'expectedPersonalVersion')::bigint or pv is distinct from (payload->>'expectedProfileVersion')::integer then raise exception 'Profile or settings changed' using errcode='40001';end if;
  if jsonb_typeof(payload->'screenings') is distinct from 'array' or jsonb_array_length(payload->'screenings')<>jsonb_array_length(req->'listingIds') then raise exception 'Incomplete screening plan' using errcode='22023';end if;
  if (select count(distinct x->>'listingId') from jsonb_array_elements(payload->'screenings') x)<>jsonb_array_length(req->'listingIds') then raise exception 'Duplicate screening plan' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(payload->'screenings') loop
   if not (req->'listingIds') ? (item->>'listingId') then raise exception 'Screening listing mismatch' using errcode='22023';end if;
   select * into o from public.search_observations where user_id=c.user_id and run_id=r.id and listing_id=(item->>'listingId')::uuid order by checked_at desc,created_at desc,id desc limit 1;
   if not found or o.id is distinct from (item->>'observationId')::uuid then raise exception 'Observed source changed' using errcode='40001';end if;
   part:=private.search_owned(c.user_id,'search.screening.save',(item-'observationId')||jsonb_build_object('runId',r.id,'eventKey',key||':'||idx));items:=items||jsonb_build_array(part);idx:=idx+1;
  end loop;
  response:=jsonb_build_object('runId',r.id,'profileId',r.profile_id,'evaluatedProfileVersion',pv,'personalVersion',coalesce(v,1),'screenings',items,'diagnostics',coalesce(payload->'diagnostics','[]'));
 end if;
 insert into private.search_requests(user_id,event_key,operation,payload,response) values(c.user_id,key,family,req,response);
 return response;
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
