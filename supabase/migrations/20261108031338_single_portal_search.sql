begin;
-- Resolve IDs only within this owner's effective portal configuration. No URL
-- injection and no temporary rewriting of shared preferences for a focused run.
create function private.selected_search_portal(owner_id uuid,portal_id text) returns jsonb
language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare portals jsonb;selected jsonb;
begin
 if portal_id is null or length(trim(portal_id)) not between 1 and 160 or portal_id ~ '[[:cntrl:]]' then raise exception 'Exact enabled portal ID required' using errcode='22023';end if;
 select projection into portals from public.search_documents where user_id=owner_id and kind='portals' and id='shared';
 if not found then portals:=private.default_search_portals();end if;
 select value into selected from jsonb_array_elements(portals->'tracked_companies') where value->>'id'=portal_id and value->>'enabled'='true';
 if selected is null then raise exception 'Enabled owned portal required' using errcode='22023';end if;
 return selected;
end $$;
revoke all on function private.selected_search_portal(uuid,text) from public,anon,authenticated;

alter function private.backend_input(uuid,text,jsonb) rename to backend_input_before_portal_search;
create function private.backend_input(owner_id uuid,kind text,input jsonb) returns void language plpgsql set search_path='' as $$
begin
 if kind='search_ats' and input ? 'portalId' then
  if jsonb_typeof(input->'portalId') is distinct from 'string' then raise exception 'Exact enabled portal ID required' using errcode='22023';end if;
  perform private.backend_input_before_portal_search(owner_id,kind,input-'portalId');
  perform private.selected_search_portal(owner_id,input->>'portalId');
 else perform private.backend_input_before_portal_search(owner_id,kind,input);
 end if;
end $$;
revoke all on function private.backend_input(uuid,text,jsonb),private.backend_input_before_portal_search(uuid,text,jsonb) from public,anon,authenticated;

-- Distinct narrow operation, delegated to the existing owned queue writer.
alter function private.backend_action(uuid,uuid,text,jsonb) rename to backend_action_before_portal_search;
create function private.backend_action(owner_id uuid,bound_connection uuid,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if operation='backend.jobs.portal.submit' then
  if jsonb_typeof(payload->'input') is distinct from 'object' or not (payload->'input' ? 'portalId') then raise exception 'Single portal search requires portalId' using errcode='22023';end if;
  return private.backend_action_before_portal_search(owner_id,bound_connection,'backend.jobs.submit',payload);
 end if;
 return private.backend_action_before_portal_search(owner_id,bound_connection,operation,payload);
end $$;
revoke all on function private.backend_action(uuid,uuid,text,jsonb),private.backend_action_before_portal_search(uuid,uuid,text,jsonb) from public,anon,authenticated;

do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('private.search_owned(uuid,text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$  mode:=coalesce(payload->>'mode','fresh');$old$,$new$  if payload ? 'portalId' then
   if jsonb_typeof(payload->'portalId') is distinct from 'string' then raise exception 'Exact enabled portal ID required' using errcode='22023';end if;
   perform private.selected_search_portal(owner_id,payload->>'portalId');
  end if;
  mode:=coalesce(payload->>'mode','fresh');$new$);
 if changed=definition then raise exception 'Search start portal validation patch unavailable';end if;definition:=changed;
 changed:=replace(definition,$old$if (x->>'enabled')::boolean then insert into public.search_source_attempts$old$,$new$if (x->>'enabled')::boolean and (not payload ? 'portalId' or x->>'id'=payload->>'portalId') then insert into public.search_source_attempts$new$);
 if changed=definition then raise exception 'Search portal source patch unavailable';end if;definition:=changed;
 changed:=replace(definition,$old$jsonb_array_elements(p->'search_queries') with ordinality loop$old$,$new$jsonb_array_elements(p->'search_queries') with ordinality where not payload ? 'portalId' loop$new$);
 if changed=definition then raise exception 'Search query scope patch unavailable';end if;
 execute changed;
 -- The worker cannot widen or change the queue request at run creation.
 definition:=pg_get_functiondef('private.backend_worker_before_applications(text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$if op='search.run.start' and args->>'eventKey'$old$,$new$if op='search.run.start' and args->'portalId' is distinct from j.input->'portalId' then raise exception 'Execution portal mismatch' using errcode='42501';end if;
   if op='search.run.start' and args->>'eventKey'$new$);
 if changed=definition then raise exception 'Worker portal fence patch unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
