-- Partial edits reuse existing owned validators and stores. No new tables.
create function private.update_owned_fields(owner_id uuid, operation text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowed text[]; args text[]; f jsonb; r jsonb; result jsonb;
 profile public.profiles; company public.company_workspaces; contact public.outreach_contacts; artifact public.career_artifacts;
 k text; v jsonb; item jsonb; nested text[];
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 allowed:=case operation
 when 'profile.fields.update' then array['name','firstName','lastName','email','phone','location','linkedin','github','portfolio','otherUrl','authorization','headline','currentEmployer','jobSearchStatus','skills','preferredSkills','languages','introduction','workExperience','education','projects']
 when 'company_workspaces.fields.update' then array['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate','sources','contactIds','applicationIds','archived']
 when 'contacts.fields.update' then array['company','contact','name','title','role','contactType','linkedin','email','source','sourceUrl','status','subject','message','notes','followUpDate','jobUrl','employmentType','link','evidence','whyThem','ask','followUp','relationship','location','tags']
 when 'artifacts.fields.update' then array['title','purpose','body','sources','links','materials','preparedFor','weekOf','company']
 else null end;
 args:=case when operation='profile.fields.update' then array['fields','expectedUpdatedAt'] when operation='artifacts.fields.update' then array['id','fields','expectedVersion'] else array['id','fields','expectedRevision'] end;
 if allowed is null or jsonb_typeof(payload) is distinct from 'object' or not payload ?& args or payload-args<>'{}' or octet_length(payload::text)>210000 then raise exception 'Invalid field update' using errcode='22023'; end if;
 f:=payload->'fields';
 if jsonb_typeof(f) is distinct from 'object' or f='{}' or f-allowed<>'{}' then raise exception 'Only named editable fields allowed' using errcode='22023'; end if;
 if operation='profile.fields.update' then
  if jsonb_typeof(payload->'expectedUpdatedAt') is distinct from 'string' then raise exception 'Current timestamp required' using errcode='22023';end if;
  for k,v in select * from jsonb_each(f) loop
   if k in ('workExperience','education','projects') then
    if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>50 then raise exception 'Bounded profile records required' using errcode='22023';end if;
    nested:=case k when 'workExperience' then array['title','company','location','employmentType','startDate','endDate','current','description'] when 'education' then array['school','degree','fieldOfStudy','gpa','startDate','endDate','description'] else array['name','role','url','startDate','endDate','description'] end;
    for item in select value from jsonb_array_elements(v) loop
     if jsonb_typeof(item) is distinct from 'object' or item-nested<>'{}' then raise exception 'Invalid profile record' using errcode='22023';end if;
     if exists(select 1 from jsonb_each(item) e where (e.key='current' and jsonb_typeof(e.value)<>'boolean') or (e.key<>'current' and (jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>20000))) then raise exception 'Invalid profile value' using errcode='22023';end if;
    end loop;
   elsif jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>20000 then raise exception 'Profile text required' using errcode='22023';end if;
  end loop;
  select * into profile from public.profiles where user_id=owner_id for update;
  if not found then raise exception 'Owned profile not found' using errcode='P0002';end if;
  return private.platform_actions_for_owner(owner_id,'profile.save',jsonb_build_object('facts',profile.facts||f,'expectedUpdatedAt',payload->'expectedUpdatedAt'));
 end if;
 if jsonb_typeof(payload->'id') is distinct from 'string' or length(payload->>'id') not between 1 and 200 then raise exception 'Record ID required' using errcode='22023';end if;
 if operation='artifacts.fields.update' then
  if jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or payload->>'expectedVersion' !~ '^[1-9][0-9]*$' then raise exception 'Current version required' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended((payload->>'id')::uuid::text,82));
  select * into artifact from public.career_artifacts where id=(payload->>'id')::uuid and user_id=owner_id for update;
  if not found then raise exception 'Owned artifact not found' using errcode='P0002';end if;
  if artifact.version<>(payload->>'expectedVersion')::integer then raise exception 'Artifact changed; reload' using errcode='40001';end if;
  return private.artifact_owned(owner_id,'artifacts.save',artifact.content||f||jsonb_build_object('id',artifact.id,'expectedVersion',artifact.version));
 end if;
 if jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or payload->>'expectedRevision' !~ '^[0-9]+$' then raise exception 'Current revision required' using errcode='22023';end if;
 if operation='company_workspaces.fields.update' then
  -- Use the same lock ordering as full company saves.
  perform pg_advisory_xact_lock(hashtext(owner_id::text));
  select * into company from public.company_workspaces where user_id=owner_id and id=payload->>'id' for update;
  if not found then raise exception 'Owned company not found' using errcode='P0002';end if;
  return private.company_actions(owner_id,'company_workspaces.save',jsonb_build_object('id',company.id,'record',private.company_record(company)||f,'expectedRevision',payload->'expectedRevision'));
 end if;
 select * into contact from public.outreach_contacts where user_id=owner_id and id=payload->>'id' and deleted_at is null and record->>'collection' is distinct from 'companies' for update;
 if not found then raise exception 'Owned contact not found' using errcode='P0002';end if;
 -- Full contact saves validate company/URLs. Also bound edited text/arrays here.
 for k,v in select * from jsonb_each(f) loop
  if k='tags' then
   if jsonb_typeof(v) is distinct from 'array' or jsonb_array_length(v)>100 or exists(select 1 from jsonb_array_elements(v) t where jsonb_typeof(t)<>'string' or length(t#>>'{}')>200) then raise exception 'Bounded tags required' using errcode='22023';end if;
  elsif jsonb_typeof(v) is distinct from 'string' or length(v#>>'{}')>20000 then raise exception 'Contact text required' using errcode='22023';end if;
 end loop;
 return private.extended_actions_for_owner(owner_id,'contacts.save',jsonb_build_object('id',contact.id,'record',contact.record||f,'expectedRevision',payload->'expectedRevision'));
end $$;
revoke all on function private.update_owned_fields(uuid,text,jsonb) from public,anon,authenticated;
-- Authenticated website adapter and opaque-credential MCP adapter share this boundary.
create function public.update_workspace_fields(operation text,payload jsonb,expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Account changed; reload' using errcode='42501';end if;
 return private.update_owned_fields(auth.uid(),operation,payload);
end $$;
revoke all on function public.update_workspace_fields(text,jsonb,uuid) from public,anon;
grant execute on function public.update_workspace_fields(text,jsonb,uuid) to authenticated;
-- A bounded read model, not a new store or inference engine.
create function private.user_brief_snapshot(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare notifications jsonb; batch jsonb; truncated boolean;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['mode','style']<>'{}' or (payload ? 'mode' and (jsonb_typeof(payload->'mode') is distinct from 'string' or payload->>'mode' not in ('on_demand','notification'))) or (payload ? 'style' and (jsonb_typeof(payload->'style') is distinct from 'string' or payload->>'style' not in ('short','urgent','detailed'))) then raise exception 'Invalid brief options' using errcode='22023';end if;
 select jsonb_build_object(
 'settings',(select search->'quietMode' from public.preferences where user_id=owner_id),
 'lastDigestAt',(select max(delivered_at) from public.notification_deliveries where user_id=owner_id and kind='digest'),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at,e.id),'[]') from (select * from public.activity_events x where user_id=owner_id and not exists(select 1 from public.notification_deliveries n where n.user_id=owner_id and n.event_ids ? x.id::text) order by occurred_at,id limit 101) e),
 'plans',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from (select application_id,version,plan from public.preparation_plans p where user_id=owner_id and not exists(select 1 from public.notification_deliveries n where n.user_id=owner_id and n.event_ids ? ('deadline:'||p.application_id||':'||p.version)) order by updated_at desc,application_id limit 101) p),
 'applications',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,status,blocker,revision from public.applications a where user_id=owner_id and status in ('Blocked','Awaiting approval') and not exists(select 1 from public.notification_deliveries n where n.user_id=owner_id and n.event_ids ? ('decision:'||a.id||':'||a.revision)) order by updated_at desc,id limit 101) a),
 'deliveries','[]'::jsonb) into notifications;
 truncated:=jsonb_array_length(notifications->'events')=101 or jsonb_array_length(notifications->'plans')=101 or jsonb_array_length(notifications->'applications')=101;
 if coalesce(payload->>'mode','on_demand')='on_demand' then
  begin batch:=private.platform_actions_for_owner(owner_id,'batches.read','{"batchId":null}');exception when no_data_found then batch:=null;end;
 end if;
 return jsonb_build_object('notifications',notifications,'batch',batch,'sourceTruncated',truncated);
end $$;
revoke all on function private.user_brief_snapshot(uuid,jsonb) from public,anon,authenticated;
create function public.read_user_brief_snapshot(payload jsonb,expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Account changed; reload' using errcode='42501';end if;
 return private.user_brief_snapshot(auth.uid(),payload);
end $$;
revoke all on function public.read_user_brief_snapshot(jsonb,uuid) from public,anon;
grant execute on function public.read_user_brief_snapshot(jsonb,uuid) to authenticated;
grant execute on function private.update_owned_fields(uuid,text,jsonb), private.user_brief_snapshot(uuid,jsonb) to service_role;
-- Extend the current entry point without increasing the legacy dispatch depth.
create or replace function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; needed text;
begin
 if operation in ('brief.read','profile.fields.update','company_workspaces.fields.update','contacts.fields.update','artifacts.fields.update') then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  needed:=case operation when 'brief.read' then 'workspace:read' when 'profile.fields.update' then 'profile:write' when 'artifacts.fields.update' then 'drafts:write' else 'network:write' end;
  if c.user_id is null or not needed=any(c.scopes) or (operation='artifacts.fields.update' and not 'workspace:read'=any(c.scopes)) then raise exception 'Required scope missing' using errcode='42501';end if;
  if operation='brief.read' then return private.user_brief_snapshot(c.user_id,payload);end if;
  return private.update_owned_fields(c.user_id,operation,payload);
 end if;
 if operation='resumes.source.replace' then
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
  if c.user_id is null or not ('resumes:write'=any(c.scopes) and 'preferences:write'=any(c.scopes)) then raise exception 'Resume and preference write scopes required' using errcode='42501';end if;
  return private.replace_resume_source_owned(c.user_id,payload);
 end if;
 if operation not like 'artifacts.%' and operation not like 'learning.%' then return private.artifact_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'workspace:read'=any(c.scopes) or (operation in ('artifacts.save','artifacts.archive','learning.save') and not 'drafts:write'=any(c.scopes)) then raise exception 'Artifact scope required' using errcode='42501';end if;
 return private.artifact_owned(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
