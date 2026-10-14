-- Scoped private resume access and agent review boundary.
-- Service-only RPC boundary. Owner identity comes from verified human Auth or
-- a hashed agent credential, never from an agent request's user_id field.
create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('workspace:read','profile:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
      then raise exception 'Invalid connection' using errcode='22023'; end if;
    -- Limits accidental repeated provisioning; revoked/expired entries do not count.
    if (select count(*) from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now()) >= 10 then
      raise exception 'Revoke an existing connection first' using errcode='22023';
    end if;
    insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
      values(owner_id,trim(payload->>'name'),payload->>'tokenHash',array(select jsonb_array_elements_text(payload->'scopes')),now()+make_interval(days=>days)) returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.profile_setup' then
    if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Enabled boolean required' using errcode='22023'; end if;
    select * into connection from private.agent_connections where user_id=owner_id and id=(payload->>'id')::uuid and revoked_at is null and expires_at>now() for update;
    if not found then raise exception 'Active owned connection not found' using errcode='P0002'; end if;
    update private.agent_connections set scopes=case when (payload->>'enabled')::boolean then
      array(select distinct s from unnest(connection.scopes || array['profile:write']) s) else array_remove(connection.scopes,'profile:write') end
      where id=connection.id returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.list' then
    select coalesce(jsonb_agg(to_jsonb(c)-'token_hash' order by created_at desc),'[]') into result from private.agent_connections c where user_id=owner_id;
    return result;
  elsif operation = 'connections.revoke' then
    update private.agent_connections set revoked_at=coalesce(revoked_at,now()) where user_id=owner_id and id=(payload->>'id')::uuid returning * into connection;
    if not found then raise exception 'Owned connection not found' using errcode='P0002'; end if;
    return to_jsonb(connection)-'token_hash';
  end if;
  raise exception 'Unknown operation' using errcode='22023';
end $$;
revoke all on function public.manage_agent_connection(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_agent_connection(uuid,text,jsonb) to service_role;

grant update on private.agent_settings_versions to service_role;
-- Explicit server grants also keep local migration tests independent of hosted defaults.
grant select,insert,update on public.profiles,public.preferences,public.resumes,public.answer_library to service_role;

-- Preparation permission is explicit and never granted retroactively to old keys.
create table private.agent_profile_imports (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null, request jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(user_id,event_key)
);
create table private.agent_resume_uploads (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null, file_name text not null, variant text not null, extension text not null,
  bytes integer not null check(bytes between 1 and 10485760), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default now()+interval '15 minutes',
  resume_id uuid, unique(user_id,event_key), foreign key(user_id,resume_id) references public.resumes(user_id,id)
);
alter table private.agent_profile_imports enable row level security;
alter table private.agent_resume_uploads enable row level security;
revoke all on private.agent_profile_imports,private.agent_resume_uploads from public,anon,authenticated;
grant all on private.agent_profile_imports,private.agent_resume_uploads to service_role;

-- Preserve deployed dispatch behavior rather than copying its evolving contracts.
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_profile_setup;
revoke all on function private.agent_dispatch_before_profile_setup(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.agent_dispatch_before_profile_setup(text,text,jsonb) to service_role;

create function public.agent_dispatch(credential_hash text, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; existing private.agent_profile_imports; p public.profiles;
  a public.answer_library; r public.resumes; slot private.agent_resume_uploads;
  proposed jsonb; answer_rows jsonb:='[]'; result jsonb; merged jsonb; version bigint; found_count integer;
begin
  if operation not in ('profile.import','resumes.begin_upload','resumes.complete_upload') then
    return private.agent_dispatch_before_profile_setup(credential_hash,operation,payload);
  end if;
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not 'profile:write'=any(c.scopes) then raise exception 'Profile setup scope required' using errcode='42501'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>196608 then raise exception 'Invalid setup payload' using errcode='22023'; end if;
  -- Serializes imports, deduplication and upload registration for this owner.
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,7));
  if operation='profile.import' then
    if exists(select 1 from jsonb_object_keys(payload) k where k not in ('eventKey','expectedPersonalVersion','facts','answers','defaultResumeId','source'))
      or length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200
      or coalesce(payload->>'expectedPersonalVersion','') !~ '^[1-9][0-9]{0,15}$'
      or not (payload ? 'facts' or payload ? 'answers' or payload ? 'defaultResumeId') then raise exception 'Invalid import' using errcode='22023'; end if;
    select * into existing from private.agent_profile_imports where user_id=c.user_id and event_key=payload->>'eventKey';
    if found then
      if existing.request is distinct from payload then raise exception 'Import key reused with different data' using errcode='40001'; end if;
      return existing.result;
    end if;
    -- Lock editable records before comparing the settings version. Concurrent human
    -- changes either precede this snapshot or produce a conflict, never silent merge.
    select * into p from public.profiles where user_id=c.user_id for update;
    perform 1 from public.preferences where user_id=c.user_id for update;
    perform 1 from public.answer_library where user_id=c.user_id order by id for update;
    perform 1 from private.agent_settings_versions where user_id=c.user_id for update;
    version:=coalesce((select v.version from private.agent_settings_versions v where user_id=c.user_id),1);
    if version<>(payload->>'expectedPersonalVersion')::bigint then raise exception 'Settings changed' using errcode='40001'; end if;
    if payload ? 'facts' then
      if jsonb_typeof(payload->'facts') is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload->'facts') k where k not in
        ('name','firstName','lastName','email','phone','location','linkedin','github','portfolio','otherUrl','authorization','headline','currentEmployer','jobSearchStatus','skills','preferredSkills','languages','introduction','workExperience','education','projects'))
        or exists(select 1 from jsonb_each(payload->'facts') f where case when f.key in ('workExperience','education','projects') then jsonb_typeof(f.value)<>'array' else jsonb_typeof(f.value)<>'string' end)
        then raise exception 'Invalid facts or verification assertion' using errcode='22023'; end if;
      merged:=coalesce(p.facts,'{}') || (payload->'facts');
      if p.user_id is null or p.facts is distinct from merged then
        insert into public.profiles(user_id,facts,verified_at) values(c.user_id,merged,null)
          on conflict(user_id) do update set facts=excluded.facts,verified_at=null,updated_at=now() returning * into p;
      end if;
    end if;
    if payload ? 'answers' then
      if jsonb_typeof(payload->'answers') is distinct from 'array' or jsonb_array_length(payload->'answers')>50 then raise exception 'Invalid answers' using errcode='22023'; end if;
      for proposed in select value from jsonb_array_elements(payload->'answers') loop
        if jsonb_typeof(proposed) is distinct from 'object' or exists(select 1 from jsonb_object_keys(proposed) k where k not in ('id','expectedVersion','question','answer','companyScope','requestedPolicy'))
          or length(trim(coalesce(proposed->>'question',''))) not between 1 and 2000 or length(trim(coalesce(proposed->>'answer',''))) not between 1 and 20000
          or coalesce(proposed->>'requestedPolicy','ask') not in ('ask','auto') then raise exception 'Invalid proposed answer' using errcode='22023'; end if;
        a:=null;
        if proposed ? 'id' then
          select * into a from public.answer_library where id=(proposed->>'id')::uuid and user_id=c.user_id;
          if not found then raise exception 'Owned answer not found' using errcode='P0002'; end if;
          if coalesce((a.context->>'version')::integer,1) is distinct from (proposed->>'expectedVersion')::integer then raise exception 'Answer changed' using errcode='40001'; end if;
        else
          select count(*) into found_count from public.answer_library where user_id=c.user_id and lower(trim(question))=lower(trim(proposed->>'question')) and lower(coalesce(company_scope,''))=lower(trim(coalesce(proposed->>'companyScope','')));
          if found_count>1 then raise exception 'Ambiguous saved question' using errcode='40001'; end if;
          if found_count=1 then
            select * into a from public.answer_library where user_id=c.user_id and lower(trim(question))=lower(trim(proposed->>'question')) and lower(coalesce(company_scope,''))=lower(trim(coalesce(proposed->>'companyScope','')));
            if a.answer is distinct from trim(proposed->>'answer') then raise exception 'Answer exists; use its ID and version' using errcode='40001'; end if;
          end if;
        end if;
        if a.id is null then
          insert into public.answer_library(user_id,question,answer,company_scope,provenance,verified_at,autofill_policy,context)
            values(c.user_id,trim(proposed->>'question'),trim(proposed->>'answer'),nullif(trim(proposed->>'companyScope'),''),'agent',null,'ask',jsonb_build_object('version',1,'source',coalesce(payload->>'source','agent-import'),'requestedPolicy',coalesce(proposed->>'requestedPolicy','ask'))) returning * into a;
        elsif a.question is distinct from trim(proposed->>'question') or a.answer is distinct from trim(proposed->>'answer') or a.company_scope is distinct from nullif(trim(proposed->>'companyScope'),'') then
          update public.answer_library set question=trim(proposed->>'question'),answer=trim(proposed->>'answer'),company_scope=nullif(trim(proposed->>'companyScope'),''),provenance='agent',verified_at=null,autofill_policy='ask',context=jsonb_build_object('version',coalesce((a.context->>'version')::integer,1)+1,'source',coalesce(payload->>'source','agent-import'),'requestedPolicy',coalesce(proposed->>'requestedPolicy','ask')),updated_at=now() where id=a.id returning * into a;
        end if;
        answer_rows:=answer_rows || jsonb_build_array(to_jsonb(a));
      end loop;
    end if;
    if payload ? 'defaultResumeId' then
      select * into r from public.resumes where id=(payload->>'defaultResumeId')::uuid and user_id=c.user_id;
      if not found then raise exception 'Owned resume not found' using errcode='P0002'; end if;
      if r.object_path is null or r.object_path !~ '\.pdf$' or r.content_hash is null then raise exception 'Default requires an uploaded PDF' using errcode='22023'; end if;
      insert into public.preferences(user_id,search) values(c.user_id,jsonb_build_object('defaultResumeId',r.id))
        on conflict(user_id) do update set search=public.preferences.search || jsonb_build_object('defaultResumeId',r.id),updated_at=now();
    end if;
    result:=jsonb_build_object('profile',to_jsonb(p),'answers',answer_rows,'defaultResumeId',(select search->>'defaultResumeId' from public.preferences where user_id=c.user_id),
      'personalVersion',coalesce((select v.version from private.agent_settings_versions v where user_id=c.user_id),1),'reviewRequired',true);
    insert into private.agent_profile_imports(user_id,event_key,request,result) values(c.user_id,payload->>'eventKey',payload,result);
    return result;
  elsif operation='resumes.begin_upload' then
    if exists(select 1 from jsonb_object_keys(payload) k where k not in ('eventKey','fileName','variant','sha256','bytes'))
      or length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200 or length(coalesce(payload->>'fileName','')) not between 1 and 200
      or lower(coalesce(payload->>'fileName','')) !~ '^[^/\\]+\.(pdf|docx)$' or coalesce(payload->>'variant','') not in ('Backend','Distributed Systems','ML Infrastructure','Master')
      or coalesce(payload->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce(payload->>'bytes','') !~ '^[1-9][0-9]{0,7}$' or (payload->>'bytes')::integer>10485760 then raise exception 'Invalid resume metadata' using errcode='22023'; end if;
    select * into slot from private.agent_resume_uploads where user_id=c.user_id and event_key=payload->>'eventKey';
    if found then
      if slot.file_name<>payload->>'fileName' or slot.variant<>payload->>'variant' or slot.sha256<>payload->>'sha256' or slot.bytes<>(payload->>'bytes')::integer then raise exception 'Upload key reused' using errcode='40001'; end if;
    else
      select * into r from public.resumes where user_id=c.user_id and content_hash=payload->>'sha256' and variant=payload->>'variant' and object_path is not null order by created_at,id limit 1;
      insert into private.agent_resume_uploads(user_id,event_key,file_name,variant,extension,bytes,sha256,resume_id)
        values(c.user_id,payload->>'eventKey',payload->>'fileName',payload->>'variant',substring(lower(payload->>'fileName') from '\.(pdf|docx)$'),(payload->>'bytes')::integer,payload->>'sha256',r.id) returning * into slot;
    end if;
  else
    if exists(select 1 from jsonb_object_keys(payload) k where k<>'uploadId') then raise exception 'Upload ID only' using errcode='22023'; end if;
    select * into slot from private.agent_resume_uploads where id=(payload->>'uploadId')::uuid and user_id=c.user_id;
    if not found then raise exception 'Owned upload not found' using errcode='P0002'; end if;
  end if;
  if slot.resume_id is not null then
    select * into r from public.resumes where id=slot.resume_id and user_id=c.user_id;
    return jsonb_build_object('resume',to_jsonb(r),'personalVersion',coalesce((select v.version from private.agent_settings_versions v where user_id=c.user_id),1));
  end if;
  if slot.expires_at<=now() then raise exception 'Upload expired; begin with new event key' using errcode='22023'; end if;
  return jsonb_build_object('uploadId',slot.id,'objectPath',c.user_id::text||'/'||slot.id::text||'.'||slot.extension,'extension',slot.extension,'bytes',slot.bytes,'sha256',slot.sha256,'expiresAt',slot.expires_at);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

-- Only the authenticated gateway can supply its measured byte count/checksum.
create function public.finish_agent_resume_upload(credential_hash text,upload_id uuid,actual_hash text,actual_bytes integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare c private.agent_connections; slot private.agent_resume_uploads; r public.resumes; next_version integer;
begin
  perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
  select * into c from private.agent_connections where token_hash=credential_hash;
  if not 'profile:write'=any(c.scopes) then raise exception 'Profile setup scope required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,7));
  select * into slot from private.agent_resume_uploads where id=upload_id and user_id=c.user_id for update;
  if not found then raise exception 'Owned upload not found' using errcode='P0002'; end if;
  if slot.resume_id is null then
    if slot.expires_at<=now() or slot.sha256<>actual_hash or slot.bytes<>actual_bytes then raise exception 'Upload verification mismatch' using errcode='22023'; end if;
    select * into r from public.resumes where user_id=c.user_id and content_hash=actual_hash and variant=slot.variant and object_path is not null order by created_at,id limit 1;
    if r.id is null then
      select coalesce(max(version),0)+1 into next_version from public.resumes where user_id=c.user_id and variant=slot.variant;
      insert into public.resumes(id,user_id,name,variant,version,object_path,content_hash)
        values(slot.id,c.user_id,slot.file_name,slot.variant,next_version,c.user_id::text||'/'||slot.id::text||'.'||slot.extension,actual_hash) returning * into r;
    end if;
    update private.agent_resume_uploads set resume_id=r.id where id=slot.id;
  else select * into r from public.resumes where id=slot.resume_id and user_id=c.user_id; end if;
  return jsonb_build_object('resume',to_jsonb(r),'personalVersion',coalesce((select v.version from private.agent_settings_versions v where user_id=c.user_id),1));
end $$;
revoke all on function public.finish_agent_resume_upload(text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.finish_agent_resume_upload(text,uuid,text,integer) to service_role;
