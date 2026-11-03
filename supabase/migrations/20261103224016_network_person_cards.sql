-- Additive person context in the existing owned contact JSON. No data rewrite.
create function private.validate_person_context(r jsonb) returns void language plpgsql set search_path='' as $$
declare k text; u jsonb; s jsonb; sources jsonb;
begin
 if jsonb_typeof(r) is distinct from 'object' then raise exception 'Person record required' using errcode='22023'; end if;
 foreach k in array array['professionalTitle','technicalInterests','relationshipSummary','nextAction'] loop
  if r?k and (jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>10000) then raise exception 'Invalid person text' using errcode='22023'; end if;
 end loop;
 if r?'company' and (jsonb_typeof(r->'company') is distinct from 'string' or length(r->>'company')>200) then raise exception 'Invalid company' using errcode='22023';end if;
 if r?'relationshipUpdates' then
  if jsonb_typeof(r->'relationshipUpdates') is distinct from 'array' then raise exception 'Updates must be an array' using errcode='22023';end if;
  if jsonb_array_length(r->'relationshipUpdates')>100 then raise exception 'Too many updates' using errcode='22023';end if;
  for u in select value from jsonb_array_elements(r->'relationshipUpdates') loop
   if jsonb_typeof(u) is distinct from 'object' or not u?&array['id','date','body'] or u-array['id','date','body']<>'{}' or exists(select 1 from jsonb_each(u) e where jsonb_typeof(e.value) is distinct from 'string') or length(btrim(u->>'id')) not between 1 and 100 or length(btrim(u->>'body')) not between 1 and 4000 or u->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or (u->>'date')::date::text<>u->>'date' then raise exception 'Invalid dated relationship update' using errcode='22023';end if;
  end loop;
  if (select count(distinct value->>'id') from jsonb_array_elements(r->'relationshipUpdates'))<>jsonb_array_length(r->'relationshipUpdates') then raise exception 'Duplicate update IDs' using errcode='22023';end if;
 end if;
 s:=r->'suggestion';
 if s is not null and s<>'null' then
  if jsonb_typeof(s) is distinct from 'object' or not s?&array['id','purpose','rationale','action','sources','createdAt','updatedAt','state'] or s-array['id','purpose','rationale','action','sources','createdAt','updatedAt','state','role','roleUrl']<>'{}' then raise exception 'Complete suggestion required' using errcode='22023';end if;
  if exists(select 1 from jsonb_each(s) e where e.key<>'sources' and jsonb_typeof(e.value) is distinct from 'string') or length(btrim(s->>'id')) not between 1 and 100 or length(btrim(s->>'rationale')) not between 1 and 4000 or length(btrim(s->>'action')) not between 1 and 1000 or s->>'purpose' not in ('connect','maintain','referral') or s->>'state' not in ('active','done','dismissed') then raise exception 'Invalid suggestion' using errcode='22023';end if;
  if s->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T' or s->>'updatedAt' !~ '^\d{4}-\d{2}-\d{2}T' then raise exception 'Suggestion timestamps required' using errcode='22023';end if;
  perform (s->>'createdAt')::timestamptz; perform (s->>'updatedAt')::timestamptz;
  if length(s->>'role')>500 or (coalesce(s->>'roleUrl','')<>'' and (s->>'roleUrl' !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or length(s->>'roleUrl')>2048)) then raise exception 'Invalid suggested role' using errcode='22023';end if;
 end if;
 foreach k in array array['sources','suggestionSources'] loop
  sources:=case k when 'sources' then r->'sources' else s->'sources' end;
  if sources is null then continue;end if;
  if jsonb_typeof(sources) is distinct from 'array' then raise exception 'Source array required' using errcode='22023';end if;
  if jsonb_array_length(sources)>30 then raise exception 'Too many sources' using errcode='22023';end if;
  for u in select value from jsonb_array_elements(sources) loop
   if jsonb_typeof(u) is distinct from 'object' or not u?&array['title','url','observedAt'] or u-array['title','url','observedAt','summary']<>'{}' or exists(select 1 from jsonb_each(u) e where jsonb_typeof(e.value) is distinct from 'string') or length(btrim(u->>'title')) not between 1 and 200 or length(u->>'url')>2048 or u->>'url' !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or u->>'observedAt' !~ '^\d{4}-\d{2}-\d{2}$' or (u->>'observedAt')::date::text<>u->>'observedAt' or length(u->>'summary')>2000 then raise exception 'Invalid dated source' using errcode='22023';end if;
  end loop;
 end loop;
end $$;
revoke all on function private.validate_person_context(jsonb) from public,anon,authenticated;
create function private.person_context_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.validate_person_context(new.record);return new;end $$;
revoke all on function private.person_context_guard() from public,anon,authenticated;
create trigger validate_person_context before insert or update of record on public.outreach_contacts for each row execute function private.person_context_guard();

-- Keep the existing dispatch chain, revision and ownership behavior for other domains.
alter function private.company_previous_extended(uuid,text,jsonb) rename to network_previous_extended;
create function private.company_previous_extended(owner_id uuid,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_contacts; r jsonb; result jsonb;
begin
 if operation<>'contacts.save' then return private.network_previous_extended(owner_id,operation,payload);end if;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload?&array['id','record','expectedRevision'] or payload-array['id','record','expectedRevision']<>'{}' or jsonb_typeof(payload->'id') is distinct from 'string' or length(payload->>'id') not between 1 and 100 or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or payload->>'expectedRevision' !~ '^[0-9]+$' then raise exception 'ID and revision required' using errcode='22023';end if;
 r:=payload->'record';
 if jsonb_typeof(r) is distinct from 'object' or octet_length(r::text)>60000 or r-array['company','contact','name','title','role','contactType','linkedin','email','source','sourceUrl','status','subject','message','notes','followUpDate','jobUrl','employmentType','link','evidence','whyThem','reason','connection','ask','followUp','relationship','location','tags','collection','companyId','professionalTitle','technicalInterests','relationshipSummary','relationshipUpdates','nextAction','suggestion','sources']<>'{}' then raise exception 'Invalid person record' using errcode='22023';end if;
 perform private.validate_person_context(r);
 if nullif(r->>'linkedin','') is not null and r->>'linkedin' !~ '^https://(www\.)?linkedin\.com/in/[a-zA-Z0-9_%\-]+/?$' then raise exception 'LinkedIn profile required' using errcode='22023';end if;
 select * into c from public.outreach_contacts where user_id=owner_id and id=payload->>'id' for update;
 if coalesce(c.revision,0)<>(payload->>'expectedRevision')::integer then raise exception 'Contact changed' using errcode='40001';end if;
 if c.id is null then
  insert into public.outreach_contacts(user_id,id,record,revision) values(owner_id,payload->>'id',r,1) on conflict(user_id,id) do nothing returning to_jsonb(outreach_contacts) into result;
  if result is null then raise exception 'Contact changed' using errcode='40001';end if;
 else
  update public.outreach_contacts set record=r,deleted_at=null where user_id=owner_id and id=c.id returning to_jsonb(outreach_contacts) into result;
 end if;
 return result;
end $$;
revoke all on function private.company_previous_extended(uuid,text,jsonb) from public,anon,authenticated;

alter function private.update_owned_fields(uuid,text,jsonb) rename to network_previous_fields;
create function private.update_owned_fields(owner_id uuid,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_contacts; f jsonb;
begin
 if operation<>'contacts.fields.update' then return private.network_previous_fields(owner_id,operation,payload);end if;
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload?&array['id','fields','expectedRevision'] or payload-array['id','fields','expectedRevision']<>'{}' or jsonb_typeof(payload->'id') is distinct from 'string' or length(payload->>'id') not between 1 and 100 or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or payload->>'expectedRevision' !~ '^[0-9]+$' then raise exception 'ID and revision required' using errcode='22023';end if;
 f:=payload->'fields';
 if jsonb_typeof(f) is distinct from 'object' or f='{}' or f-array['company','contact','name','title','role','contactType','linkedin','email','source','sourceUrl','status','subject','message','notes','followUpDate','jobUrl','employmentType','link','evidence','whyThem','reason','connection','ask','followUp','relationship','location','tags','professionalTitle','technicalInterests','relationshipSummary','relationshipUpdates','nextAction','suggestion','sources']<>'{}' then raise exception 'Only editable person fields allowed' using errcode='22023';end if;
 if exists(select 1 from jsonb_each(f) e where e.key not in ('tags','sources','relationshipUpdates','suggestion') and (jsonb_typeof(e.value) is distinct from 'string' or length(e.value#>>'{}')>20000)) then raise exception 'Bounded contact text required' using errcode='22023';end if;
 if f?'tags' then
  if jsonb_typeof(f->'tags') is distinct from 'array' then raise exception 'Tag array required' using errcode='22023';end if;
  if jsonb_array_length(f->'tags')>100 or exists(select 1 from jsonb_array_elements(f->'tags') t where jsonb_typeof(t) is distinct from 'string' or length(t#>>'{}')>200) then raise exception 'Invalid tags' using errcode='22023';end if;
 end if;
 select * into c from public.outreach_contacts where user_id=owner_id and id=payload->>'id' and deleted_at is null and record->>'collection' is distinct from 'companies' for update;
 if not found then raise exception 'Owned person required' using errcode='P0002';end if;
 return private.extended_actions_for_owner(owner_id,'contacts.save',jsonb_build_object('id',c.id,'record',c.record||f,'expectedRevision',payload->'expectedRevision'));
end $$;
revoke all on function private.update_owned_fields(uuid,text,jsonb) from public,anon,authenticated;
