begin;
create table public.application_milestones (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid not null,event_key text not null check(length(event_key) between 1 and 200),
 kind text not null check(kind in ('submitted','recruiter_call','technical_round','interview','offer','rejected','withdrawn')),
 label text not null check(length(label) between 1 and 300),occurred_at timestamptz,
 phase text not null check(phase in ('scheduled','completed','received')),source jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade,
 unique(user_id,event_key)
);
alter table public.application_milestones enable row level security;
revoke all on public.application_milestones from public,anon,authenticated;
grant select on public.application_milestones to authenticated;
grant all on public.application_milestones to service_role;
create policy milestone_owner_read on public.application_milestones for select to authenticated using((select auth.uid())=user_id);
create index milestone_owner_application on public.application_milestones(user_id,application_id,created_at,id);

create function private.record_application_milestone_owned(owner_id uuid,app_id uuid,payload jsonb,source_kind text)
returns public.application_milestones language plpgsql security definer set search_path='' as $$
declare m public.application_milestones; s jsonb:=payload->'source'; date_value timestamptz;
begin
 perform 1 from public.applications where id=app_id and user_id=owner_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-'eventKey'-'kind'-'label'-'occurredAt'-'phase'-'source'<>'{}'::jsonb
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200
  or jsonb_typeof(payload->'label') is distinct from 'string' or length(trim(coalesce(payload->>'label',''))) not between 1 and 300
  or coalesce(payload->>'kind','') not in ('submitted','recruiter_call','technical_round','interview','offer','rejected','withdrawn')
  or coalesce(payload->>'phase','') not in ('scheduled','completed','received')
  or jsonb_typeof(s) is distinct from 'object' or s->>'kind' is distinct from source_kind
  or s-'kind'-'messageId'-'subject'-'excerpt'-'receivedAt'-'timestampConfirmed'-'note'<>'{}'::jsonb or octet_length(s::text)>10000
 then raise exception 'Invalid milestone' using errcode='22023'; end if;
 if source_kind='email' then
  if not (s ?& array['messageId','subject','excerpt','receivedAt'])
   or jsonb_typeof(s->'messageId') is distinct from 'string' or length(trim(coalesce(s->>'messageId',''))) not between 1 and 200
   or jsonb_typeof(s->'subject') is distinct from 'string' or length(trim(coalesce(s->>'subject',''))) not between 1 and 300
   or jsonb_typeof(s->'excerpt') is distinct from 'string' or length(trim(coalesce(s->>'excerpt',''))) not between 1 and 2000
   or coalesce(s->>'receivedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$'
  then raise exception 'Email evidence required' using errcode='22023'; end if;
  perform (s->>'receivedAt')::timestamptz;
 elsif source_kind<>'user' then raise exception 'Unsupported milestone source' using errcode='22023';
 end if;
 if s ? 'note' and (jsonb_typeof(s->'note') is distinct from 'string' or length(s->>'note')>2000) then raise exception 'Invalid source note' using errcode='22023'; end if;
 if payload->'occurredAt' is not null and payload->'occurredAt'<>'null'::jsonb then
  if jsonb_typeof(payload->'occurredAt') is distinct from 'string' or coalesce(payload->>'occurredAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' or s->'timestampConfirmed' is distinct from 'true'::jsonb
  then raise exception 'Confirmed timestamp with explicit timezone required; otherwise leave date null' using errcode='22023'; end if;
  date_value:=(payload->>'occurredAt')::timestamptz;
 end if;
 insert into public.application_milestones(user_id,application_id,event_key,kind,label,occurred_at,phase,source)
 values(owner_id,app_id,payload->>'eventKey',payload->>'kind',payload->>'label',date_value,payload->>'phase',s)
 on conflict(user_id,event_key) do nothing returning * into m;
 if m.id is null then
  select * into m from public.application_milestones where user_id=owner_id and event_key=payload->>'eventKey';
  if m.application_id is distinct from app_id or m.kind is distinct from payload->>'kind' or m.label is distinct from payload->>'label'
   or m.occurred_at is distinct from date_value or m.phase is distinct from payload->>'phase' or m.source is distinct from s
  then raise exception 'Milestone event key reused with different evidence' using errcode='40001'; end if;
 end if;
 insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
 values(owner_id,app_id,'milestone:'||m.id,'application_milestone',case when source_kind='user' then 'user' else 'agent' end,
  jsonb_build_object('text',m.label,'milestoneId',m.id,'kind',case when m.kind in ('recruiter_call','technical_round','interview') then 'interview' else m.kind end,'actionRequired',m.phase='scheduled','deadlineAt',m.occurred_at))
 on conflict(user_id,event_key) do nothing;
 -- Milestones are process observations, never application receipts or approvals.
 return m;
end $$;
revoke all on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) to service_role;
create function private.record_application_milestone_authenticated(app_id uuid,payload jsonb)
returns public.application_milestones language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.record_application_milestone_owned(auth.uid(),app_id,payload,'user');
end $$;
revoke all on function private.record_application_milestone_authenticated(uuid,jsonb) from public,anon;
grant execute on function private.record_application_milestone_authenticated(uuid,jsonb) to authenticated;
create function public.record_application_milestone(app_id uuid,payload jsonb)
returns public.application_milestones language sql security invoker set search_path='' as $$ select private.record_application_milestone_authenticated(app_id,payload) $$;
revoke all on function public.record_application_milestone(uuid,jsonb) from public,anon;
grant execute on function public.record_application_milestone(uuid,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to milestones_dispatch_previous;
revoke all on function private.milestones_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.milestones_dispatch_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; a public.applications; result jsonb; needed text;
begin
 if operation not in ('applications.timeline','applications.milestone','applications.record','workspace.read') then return private.milestones_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 needed:=case when operation='applications.milestone' then 'activity:write' else 'workspace:read' end;
 if not needed=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if operation='workspace.read' then
  result:=private.milestones_dispatch_previous(credential_hash,operation,payload);
  return result||jsonb_build_object('milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from public.application_milestones m where m.user_id=c.user_id));
 end if;
 select * into a from public.applications where id=(payload->>'applicationId')::uuid and user_id=c.user_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if operation='applications.milestone' then
  return to_jsonb(private.record_application_milestone_owned(c.user_id,a.id,payload-'applicationId','email'));
 end if;
 result:=case when operation='applications.record' then private.milestones_dispatch_previous(credential_hash,operation,payload) else jsonb_build_object('application',to_jsonb(a)) end;
 return result||jsonb_build_object('milestones',(select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at,m.id),'[]') from public.application_milestones m where m.user_id=c.user_id and m.application_id=a.id));
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
