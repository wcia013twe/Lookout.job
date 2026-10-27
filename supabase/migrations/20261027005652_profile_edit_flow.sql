-- One lightweight versioned writer for browser and MCP personal-fact patches.
create function private.patch_profile_facts(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; f jsonb; merged jsonb; k text; v jsonb; item jsonb; allowed text[]; result jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& array['fields','expectedUpdatedAt'] or payload-array['fields','expectedUpdatedAt']<>'{}' or octet_length(payload::text)>210000 then raise exception 'Fields and current profile timestamp required' using errcode='22023';end if;
 if jsonb_typeof(payload->'expectedUpdatedAt') not in ('string','null') then raise exception 'Current profile timestamp required' using errcode='22023';end if;
 f:=payload->'fields';
 if jsonb_typeof(f) is distinct from 'object' or f-array['name','firstName','lastName','preferredName','suffix','email','phone','birthday','location','address','address2','address3','postalCode','linkedin','github','portfolio','otherUrl','authorization','headline','currentEmployer','jobSearchStatus','skills','preferredSkills','languages','introduction','workExperience','education','projects']<>'{}' then raise exception 'Only named profile facts allowed' using errcode='22023';end if;
 for k,v in select * from jsonb_each(f) loop
  if k in ('workExperience','education','projects') then
   if jsonb_typeof(v)<>'array' or jsonb_array_length(v)>50 then raise exception 'Bounded profile records required' using errcode='22023';end if;
   allowed:=case k when 'workExperience' then array['title','company','location','employmentType','startDate','endDate','current','description'] when 'education' then array['school','degree','fieldOfStudy','gpa','startDate','endDate','description'] else array['name','role','url','startDate','endDate','description'] end;
   for item in select value from jsonb_array_elements(v) loop
    if jsonb_typeof(item)<>'object' or item-allowed<>'{}' or exists(select 1 from jsonb_each(item) e where case when e.key='current' then jsonb_typeof(e.value)<>'boolean' else jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>20000 end) then raise exception 'Invalid profile record' using errcode='22023';end if;
   end loop;
  elsif jsonb_typeof(v)<>'string' or length(v#>>'{}')>20000 then raise exception 'Profile text required' using errcode='22023';end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,88));
 select * into p from public.profiles where user_id=owner_id for update;
 if p.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'Profile changed; reload before saving' using errcode='PT409';end if;
 merged:=coalesce(p.facts,'{}')||f;
 if p.user_id is not null and merged=p.facts then return to_jsonb(p);end if;
 insert into public.profiles(user_id,facts,verified_at,updated_at) values(owner_id,merged,null,greatest(clock_timestamp(),p.updated_at+interval '1 microsecond'))
 on conflict(user_id) do update set facts=excluded.facts,verified_at=null,updated_at=excluded.updated_at returning to_jsonb(profiles.*) into result;
 return result;
end $$;
revoke all on function private.patch_profile_facts(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.patch_profile_facts(uuid,jsonb) to service_role;
create function public.save_profile_changes(payload jsonb,expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Account changed' using errcode='42501';end if;
 return private.patch_profile_facts(auth.uid(),payload);
end $$;
revoke all on function public.save_profile_changes(jsonb,uuid) from public,anon;
grant execute on function public.save_profile_changes(jsonb,uuid) to authenticated;
-- Human review is never a field an agent can patch or a side effect of a fact save.
create function public.review_profile_facts(expected_updated_at timestamptz,reviewed boolean,expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles;result jsonb;
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Human account required' using errcode='42501';end if;
 if reviewed is null or expected_updated_at is null then raise exception 'Review state and profile version required' using errcode='22023';end if;
 select * into p from public.profiles where user_id=auth.uid() for update;
 if not found then raise exception 'Owned profile not found' using errcode='P0002';end if;
 if p.updated_at is distinct from expected_updated_at then raise exception 'Profile changed; review the latest facts' using errcode='PT409';end if;
 if (p.verified_at is not null)=reviewed then return to_jsonb(p);end if;
 update public.profiles set verified_at=case when reviewed then clock_timestamp() else null end,
 updated_at=greatest(clock_timestamp(),p.updated_at+interval '1 microsecond') where user_id=auth.uid() returning to_jsonb(profiles.*) into result;
 return result;
end $$;
revoke all on function public.review_profile_facts(timestamptz,boolean,uuid) from public,anon;
grant execute on function public.review_profile_facts(timestamptz,boolean,uuid) to authenticated;
-- Retire the unversioned browser upsert. Owned reads remain available via RLS.
revoke insert,update,delete on public.profiles from authenticated;

-- Existing MCP partial updates converge on the same writer.
create or replace function private.update_owned_fields(owner_id uuid, operation text, payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowed text[]; args text[]; f jsonb; r jsonb; result jsonb;
 profile public.profiles; company public.company_workspaces; contact public.outreach_contacts; artifact public.career_artifacts;
 k text; v jsonb; item jsonb; nested text[];
begin
 if operation='profile.fields.update' then return private.patch_profile_facts(owner_id,payload);end if;
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
