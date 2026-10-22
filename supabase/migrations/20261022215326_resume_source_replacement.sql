begin;
alter table public.resumes add column superseded_by uuid references public.resumes(id);
create index resume_superseded on public.resumes(superseded_by) where superseded_by is not null;
create function private.replace_resume_source_owned(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old public.resumes; fresh public.resumes;prefs public.preferences;next_search jsonb;profiles jsonb:='[]';profile jsonb;instructions text;rules jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['resumeId','replacementId','expectedVersion']<>'{}' or not payload ?& array['resumeId','replacementId','expectedVersion'] or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or payload->>'expectedVersion' !~ '^[1-9][0-9]*$' then raise exception 'Resume IDs and current version required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,83));
 select * into old from public.resumes where user_id=owner_id and id=(payload->>'resumeId')::uuid for update;
 select * into fresh from public.resumes where user_id=owner_id and id=(payload->>'replacementId')::uuid for update;
 if old.id is null or fresh.id is null then raise exception 'Owned resumes required' using errcode='P0002';end if;
 if old.id=fresh.id or old.version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Resume changed; reload before replacing' using errcode='40001';end if;
 if old.superseded_by is not null and old.superseded_by<>fresh.id then raise exception 'Resume source changed; reload' using errcode='40001';end if;
 if old.superseded_by is null then
  if fresh.object_path is null or fresh.content_hash is null or fresh.object_path not like owner_id::text||'/%' or fresh.superseded_by is not null or exists(select 1 from public.resumes where superseded_by=fresh.id) then raise exception 'New owned uploaded file required' using errcode='22023';end if;
  -- Keep both immutable file rows. Existing drafts and approvals keep the old ID/hash.
  update public.resumes set name=old.name,variant=old.variant,version=old.version+1 where id=fresh.id returning * into fresh;
  update public.resumes set superseded_by=fresh.id where id=old.id returning * into old;
  insert into public.preferences(user_id) values(owner_id) on conflict(user_id) do nothing;
  select * into prefs from public.preferences where user_id=owner_id for update;
  next_search:=coalesce(prefs.search,'{}');
  if next_search->>'defaultResumeId'=old.id::text then next_search:=jsonb_set(next_search,'{defaultResumeId}',to_jsonb(fresh.id::text));end if;
  if jsonb_typeof(next_search->'resumeRules')='array' then
   select coalesce(jsonb_agg(case when x->>'resumeId'=old.id::text then jsonb_set(x,'{resumeId}',to_jsonb(fresh.id::text)) else x end),'[]') into rules from jsonb_array_elements(next_search->'resumeRules') x;
   next_search:=jsonb_set(next_search,'{resumeRules}',rules);
  end if;
  for profile in select value from jsonb_array_elements(coalesce(next_search->'profiles','[]')) loop
   instructions:=coalesce(profile->>'instructions','');
   instructions:=regexp_replace(instructions,'(- Default resume ID: *)'||old.id::text||'([[:space:]]|$)',E'\\1'||fresh.id::text||E'\\2','g');
   instructions:=regexp_replace(instructions,'("resumeId"[[:space:]]*:[[:space:]]*")'||old.id::text||'(")',E'\\1'||fresh.id::text||E'\\2','g');
   if instructions is distinct from coalesce(profile->>'instructions','') then profile:=profile||jsonb_build_object('instructions',instructions,'version',coalesce((profile->>'version')::integer,0)+1);end if;
   profiles:=profiles||jsonb_build_array(profile);
  end loop;
  if next_search ? 'profiles' then next_search:=jsonb_set(next_search,'{profiles}',profiles);end if;
  update public.preferences set search=next_search,updated_at=now() where user_id=owner_id;
 else select p.search into next_search from public.preferences p where p.user_id=owner_id;
 end if;
 return jsonb_build_object('previous',to_jsonb(old),'resume',to_jsonb(fresh),'search',coalesce(next_search,'{}'));
end $$;
revoke all on function private.replace_resume_source_owned(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.replace_resume_source_owned(uuid,jsonb) to service_role;
create function public.replace_resume_source(payload jsonb) returns jsonb language sql security definer set search_path='' as $$select private.replace_resume_source_owned(auth.uid(),payload)$$;
revoke all on function public.replace_resume_source(jsonb) from public,anon;
grant execute on function public.replace_resume_source(jsonb) to authenticated;
-- Extend the current entry point without adding another legacy dispatch stack frame.
create or replace function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
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
commit;
