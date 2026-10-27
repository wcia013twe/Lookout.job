begin;
-- Append-only corrections retain original evidence. Ownership is validated under
-- a row lock by the shared browser/MCP helper; one replacement per event.
alter table public.application_milestones add column supersedes_id uuid references public.application_milestones(id);
create unique index application_milestone_replacement on public.application_milestones(supersedes_id) where supersedes_id is not null;
create or replace function private.record_application_milestone_owned(owner_id uuid,app_id uuid,payload jsonb,source_kind text)
returns public.application_milestones language plpgsql security definer set search_path='' as $$
declare m public.application_milestones; s jsonb:=payload->'source'; date_value timestamptz; replacement_id uuid;
begin
 perform 1 from public.applications where id=app_id and user_id=owner_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-'supersedesId'-'eventKey'-'kind'-'label'-'occurredAt'-'phase'-'source'<>'{}'::jsonb
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
 elsif source_kind='user_reported' then
  if jsonb_typeof(s->'note') is distinct from 'string' or length(trim(coalesce(s->>'note',''))) not between 1 and 2000 or s-'kind'-'note'-'timestampConfirmed'<>'{}'::jsonb then raise exception 'Candidate report required' using errcode='22023'; end if;
 elsif source_kind<>'user' then raise exception 'Unsupported milestone source' using errcode='22023';
 end if;
 if s ? 'note' and (jsonb_typeof(s->'note') is distinct from 'string' or length(s->>'note')>2000) then raise exception 'Invalid source note' using errcode='22023'; end if;
 if payload->'occurredAt' is not null and payload->'occurredAt'<>'null'::jsonb then
  if jsonb_typeof(payload->'occurredAt') is distinct from 'string' or coalesce(payload->>'occurredAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' or s->'timestampConfirmed' is distinct from 'true'::jsonb
  then raise exception 'Confirmed timestamp with explicit timezone required; otherwise leave date null' using errcode='22023'; end if;
  date_value:=(payload->>'occurredAt')::timestamptz;
 end if;
 if payload ? 'supersedesId' then
  if jsonb_typeof(payload->'supersedesId') is distinct from 'string' or payload->>'supersedesId' !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Invalid replacement ID' using errcode='22023'; end if;
  replacement_id:=(payload->>'supersedesId')::uuid;
  -- Serialize replacement writers on the original owned row; exact retries may replay.
  perform 1 from public.application_milestones where id=replacement_id and user_id=owner_id and application_id=app_id for update;
  if not found then raise exception 'Owned milestone not found' using errcode='P0002'; end if;
  if exists(select 1 from public.application_milestones where supersedes_id=replacement_id and (user_id<>owner_id or event_key<>payload->>'eventKey')) then raise exception 'Milestone already replaced; reread timeline' using errcode='40001'; end if;
 end if;
 insert into public.application_milestones(user_id,application_id,event_key,kind,label,occurred_at,phase,source,supersedes_id)
 values(owner_id,app_id,payload->>'eventKey',payload->>'kind',payload->>'label',date_value,payload->>'phase',s,replacement_id)
 on conflict(user_id,event_key) do nothing returning * into m;
 if m.id is null then
  select * into m from public.application_milestones where user_id=owner_id and event_key=payload->>'eventKey';
  if m.application_id is distinct from app_id or m.kind is distinct from payload->>'kind' or m.label is distinct from payload->>'label'
   or m.occurred_at is distinct from date_value or m.phase is distinct from payload->>'phase' or m.source is distinct from s or m.supersedes_id is distinct from replacement_id
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

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to interview_reporting_dispatch_previous;
revoke all on function private.interview_reporting_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.interview_reporting_dispatch_previous(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; source_kind text;
begin
 if operation<>'applications.milestone' then return private.interview_reporting_dispatch_previous(credential_hash,operation,payload); end if;
 perform private.interview_reporting_dispatch_previous(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'activity:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 source_kind:=payload->'source'->>'kind';
 if source_kind is null or source_kind not in ('email','user_reported') then raise exception 'Email evidence or candidate report required' using errcode='22023'; end if;
 return to_jsonb(private.record_application_milestone_owned(c.user_id,(payload->>'applicationId')::uuid,payload-'applicationId',source_kind));
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
