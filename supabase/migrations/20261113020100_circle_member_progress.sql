begin;
alter table private.circle_members
 add column progress_shared boolean not null default false,
 add column career_stage text check(career_stage in ('exploring','applying','interviewing','offer')),
 add column progress_revision integer not null default 0;

create function private.clear_circle_progress_on_departure() returns trigger language plpgsql set search_path='' as $$
begin
 if old.active and not new.active then
  new.progress_shared:=false; new.career_stage:=null; new.progress_revision:=old.progress_revision+1;
 end if;
 return new;
end $$;
revoke all on function private.clear_circle_progress_on_departure() from public,anon,authenticated;
create trigger circle_progress_departure before update of active on private.circle_members
 for each row execute function private.clear_circle_progress_on_departure();

alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to progress_previous_knowledge_action;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare result jsonb; cid uuid; member private.circle_members; request private.knowledge_requests; week_start timestamptz;
begin
 if op not in ('circles.read','circles.progress') then return private.progress_previous_knowledge_action(actor,op,payload,connection); end if;
 if op='circles.read' then
  result:=private.progress_previous_knowledge_action(actor,op,payload,connection);
  if result->>'available'='false' then return result; end if;
  cid:=(payload->>'circleId')::uuid;
  week_start:=date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
  return result||jsonb_build_object(
   'progressSettings',(select jsonb_build_object('shared',m.progress_shared,'careerStage',m.career_stage,'revision',m.progress_revision) from private.circle_members m where m.circle_id=cid and m.user_id=actor and m.active),
   'progressWeekStart',week_start,
   'members',(select coalesce(jsonb_agg(item || jsonb_build_object('progress',case when m.progress_shared then jsonb_build_object(
    'careerStage',m.career_stage,
    'applications', (select count(*) from public.applications a where a.user_id=m.user_id and a.submitted_at>=week_start and a.submitted_at<week_start+interval '7 days'),
    'interviews', (select count(*) from public.application_milestones milestone where milestone.user_id=m.user_id and milestone.kind in ('recruiter_call','technical_round','interview') and milestone.phase='completed' and milestone.occurred_at>=week_start and milestone.occurred_at<week_start+interval '7 days')
   ) else null end)),'[]'::jsonb) from jsonb_array_elements(result->'members') item join private.circle_members m on m.circle_id=cid and m.user_id=(item->>'id')::uuid and m.active));
 end if;
 if actor is null or connection is not null then raise exception 'Human sharing selection required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>24000 or exists(select 1 from jsonb_object_keys(payload) k where k not in ('circleId','shared','careerStage','expectedRevision','eventKey')) or jsonb_typeof(payload->'circleId') is distinct from 'string' or jsonb_typeof(payload->'shared') is distinct from 'boolean' or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision') !~ '^[0-9]+$' or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(payload->>'eventKey') not between 1 and 100 or (payload ? 'careerStage' and payload->'careerStage'<>'null'::jsonb and (jsonb_typeof(payload->'careerStage') is distinct from 'string' or payload->>'careerStage' not in ('exploring','applying','interviewing','offer'))) or (payload->'shared'='false'::jsonb and payload->>'careerStage' is not null) then raise exception 'Invalid progress settings' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,41));
 result:=private.progress_previous_knowledge_action(actor,'circles.read',jsonb_build_object('circleId',payload->'circleId'),null);
 if result->>'available'='false' then return result; end if;
 cid:=(payload->>'circleId')::uuid;
 select * into member from private.circle_members m where m.circle_id=cid and m.user_id=actor and m.active for update;
 if not found then raise exception 'Circle unavailable' using errcode='42501'; end if;
 select * into request from private.knowledge_requests r where r.user_id=actor and r.event_key=payload->>'eventKey';
 if found then
  if request.operation<>op or request.payload<>payload then raise exception 'Idempotency key changed' using errcode='40001'; end if;
  if (request.result->>'revision')::integer<>member.progress_revision then raise exception 'Progress settings changed' using errcode='40001'; end if;
  return request.result;
 end if;
 if payload->'shared'='true'::jsonb and (select count(*) from private.knowledge_requests where user_id=actor and created_at>now()-interval '1 hour')>=200 then raise exception 'Circle write limit reached; retry later' using errcode='54000'; end if;
 if member.progress_revision<>(payload->>'expectedRevision')::integer then raise exception 'Progress settings changed' using errcode='40001'; end if;
 update private.circle_members set progress_shared=(payload->>'shared')::boolean,career_stage=payload->>'careerStage',progress_revision=progress_revision+1 where circle_id=cid and user_id=actor returning progress_revision into member.progress_revision;
 result:=jsonb_build_object('revision',member.progress_revision);
 insert into private.knowledge_requests(user_id,event_key,operation,payload,result) values(actor,payload->>'eventKey',op,payload,result);
 return result;
end $$;
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.progress_previous_knowledge_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
commit;
