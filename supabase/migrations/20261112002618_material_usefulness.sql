begin;
create table public.career_artifact_feedback (
 artifact_id uuid not null,
 version integer not null,
 user_id uuid not null references auth.users on delete cascade,
 revision integer not null check(revision>0),
 useful boolean not null,
 note text not null default '' check(length(note)<=2000),
 source text not null check(source in ('user','agent_reported')),
 updated_at timestamptz not null default now(),
 primary key(artifact_id,version),
 foreign key(artifact_id,version) references public.career_artifact_revisions(artifact_id,version) on delete cascade
);
create index career_artifact_feedback_owner on public.career_artifact_feedback(user_id);
alter table public.career_artifact_feedback enable row level security;
revoke all on public.career_artifact_feedback from public,anon,authenticated;
grant select on public.career_artifact_feedback to authenticated;
grant all on public.career_artifact_feedback to service_role;
create policy artifact_feedback_owner_read on public.career_artifact_feedback for select to authenticated using(user_id=(select auth.uid()));

create function private.save_artifact_feedback(owner_id uuid,payload jsonb,feedback_source text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item_id uuid; item_version integer; expected integer; previous public.career_artifact_feedback; saved public.career_artifact_feedback;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& array['id','version','expectedRevision','useful','note'] or payload-array['id','version','expectedRevision','useful','note']<>'{}'::jsonb
 or jsonb_typeof(payload->'id') is distinct from 'string' or jsonb_typeof(payload->'useful') is distinct from 'boolean' or jsonb_typeof(payload->'note') is distinct from 'string' or length(payload->>'note')>2000
 or jsonb_typeof(payload->'version') is distinct from 'number' or (payload->>'version')!~'^[1-9][0-9]*$'
 or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision')!~'^(0|[1-9][0-9]*)$'
 then raise exception 'Invalid material feedback' using errcode='22023';end if;
 item_id:=(payload->>'id')::uuid;item_version:=(payload->>'version')::integer;expected:=(payload->>'expectedRevision')::integer;
 perform 1 from public.career_artifacts where id=item_id and user_id=owner_id for update;
 if not found or not exists(select 1 from public.career_artifact_revisions where artifact_id=item_id and version=item_version and user_id=owner_id) then raise exception 'Artifact not found' using errcode='42501';end if;
 select * into previous from public.career_artifact_feedback where artifact_id=item_id and version=item_version and user_id=owner_id;
 if previous.revision=expected+1 and previous.useful=(payload->>'useful')::boolean and previous.note=payload->>'note' and previous.source=feedback_source then return to_jsonb(previous)-array['artifact_id','user_id'];end if;
 if coalesce(previous.revision,0)<>expected then raise exception 'Feedback changed; read the material again' using errcode='40001';end if;
 insert into public.career_artifact_feedback(artifact_id,version,user_id,revision,useful,note,source)
 values(item_id,item_version,owner_id,expected+1,(payload->>'useful')::boolean,payload->>'note',feedback_source)
 on conflict(artifact_id,version) do update set revision=excluded.revision,useful=excluded.useful,note=excluded.note,source=excluded.source,updated_at=now()
 returning * into saved;
 return to_jsonb(saved)-array['artifact_id','user_id'];
end $$;

alter function private.artifact_owned(uuid,text,jsonb) rename to artifact_before_usefulness;
create function private.artifact_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=private.artifact_before_usefulness(owner_id,operation,payload);
 if operation='artifacts.read' then
  result:=result||jsonb_build_object(
   'feedback',(select to_jsonb(feedback)-array['artifact_id','user_id'] from public.career_artifact_feedback feedback where user_id=owner_id and artifact_id=(result->>'id')::uuid and version=(result->>'version')::integer),
   'feedbackHistory',(select coalesce(jsonb_agg(to_jsonb(feedback)-array['artifact_id','user_id'] order by version desc),'[]') from public.career_artifact_feedback feedback where user_id=owner_id and artifact_id=(result->>'id')::uuid));
 end if;
 return result;
end $$;
create or replace function public.artifact_action(operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if operation='artifacts.feedback.save' then return private.save_artifact_feedback(auth.uid(),payload,'user');end if;
 return private.artifact_owned(auth.uid(),operation,payload);
end $$;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_usefulness;
alter function public.agent_dispatch_before_usefulness(text,text,jsonb) set schema private;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare connection private.agent_connections;
begin
 if operation<>'artifacts.feedback.save' then return private.agent_dispatch_before_usefulness(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into connection from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if connection.user_id is null or not ('workspace:read'=any(connection.scopes) and 'drafts:write'=any(connection.scopes)) then raise exception 'Artifact scope required' using errcode='42501';end if;
 return private.save_artifact_feedback(connection.user_id,payload,'agent_reported');
end $$;
revoke all on function private.save_artifact_feedback(uuid,jsonb,text),private.artifact_owned(uuid,text,jsonb),private.artifact_before_usefulness(uuid,text,jsonb),private.agent_dispatch_before_usefulness(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
revoke all on function public.artifact_action(text,jsonb) from public,anon;
grant execute on function public.artifact_action(text,jsonb) to authenticated;
commit;
