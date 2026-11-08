begin;
-- These are receipts and an execution fence, never a second copy of domain work.
create table public.application_work_holds (
 user_id uuid not null references auth.users(id) on delete cascade,
 application_id uuid primary key references public.applications(id) on delete cascade,
 stopped_at timestamptz not null default now(), resumed_at timestamptz, version integer not null default 1 check(version>0)
);
alter table public.application_work_holds enable row level security;
revoke all on public.application_work_holds from public,anon,authenticated;
grant select on public.application_work_holds to authenticated;
grant all on public.application_work_holds to service_role;
create policy work_hold_read on public.application_work_holds for select to authenticated using(user_id=(select auth.uid()));
create table private.action_decision_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 decision_key text not null, source_kind text not null, source_id text not null, reviewed_at timestamptz, response text check(response in ('accept','reject')),
 responded_at timestamptz, primary key(user_id,decision_key)
);
create table private.action_response_events (
 user_id uuid not null references auth.users(id) on delete cascade,event_key uuid not null,
 request jsonb not null,result jsonb not null,primary key(user_id,event_key)
);
revoke all on private.action_decision_receipts,private.action_response_events from public,anon,authenticated;
grant all on private.action_decision_receipts,private.action_response_events to service_role;

create function private.work_is_stopped(owner_id uuid,app_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.application_work_holds where user_id=owner_id and application_id=app_id and resumed_at is null)
$$;
revoke all on function private.work_is_stopped(uuid,uuid) from public,anon,authenticated;
create function private.guard_stopped_application() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='applications' then
  if new.draft is distinct from old.draft or new.blocker is distinct from old.blocker or (new.status='Approved' and old.status<>'Approved') then
   if private.work_is_stopped(new.user_id,new.id) then raise exception 'Agent work stopped; resume explicitly first' using errcode='42501';end if;
  end if;
 elsif tg_table_name='backend_jobs' then
  if new.kind='application_submit' and new.status in ('queued','running') then
   perform 1 from public.applications where id=(new.input->>'applicationId')::uuid and user_id=new.user_id for update;
   if private.work_is_stopped(new.user_id,(new.input->>'applicationId')::uuid) then raise exception 'Agent work stopped' using errcode='42501';end if;
  end if;
 elsif tg_table_name in ('preparation_plans','approvals') then
  if tg_table_name='preparation_plans' then
   if exists(select 1 from jsonb_array_elements(coalesce(new.plan->'tasks','[]')) t where t?'roundId' and not exists(select 1 from public.application_milestones m where m.user_id=new.user_id and m.application_id=new.application_id and m.round_id::text=t->>'roundId')) then raise exception 'Preparation round must belong to this application' using errcode='22023';end if;
  end if;
  perform 1 from public.applications where id=new.application_id and user_id=new.user_id for update;
  if private.work_is_stopped(new.user_id,new.application_id) then raise exception 'Agent work stopped' using errcode='42501';end if;
 end if;
 return new;
end $$;
revoke all on function private.guard_stopped_application() from public,anon,authenticated;
create trigger guard_stopped_application before update on public.applications for each row execute function private.guard_stopped_application();
create trigger guard_stopped_application before insert or update on private.backend_jobs for each row execute function private.guard_stopped_application();
create trigger guard_stopped_application before insert or update on public.preparation_plans for each row execute function private.guard_stopped_application();
create trigger guard_stopped_application before insert on public.approvals for each row execute function private.guard_stopped_application();

-- Extend existing append-only round evidence. Corrections retain stable round_id.
alter table public.application_milestones drop constraint application_milestones_phase_check;
alter table public.application_milestones add constraint application_milestones_phase_check check(phase in ('scheduled','completed','received','cancelled'));
alter table public.application_milestones add column round_id uuid;
alter table public.application_milestones add column practice_category text not null default 'general' check(practice_category in ('general','coding','systems','behavioral','sql','ml'));
alter table public.application_milestones add column time_zone text not null default 'UTC';
alter table public.application_milestones add column confirmation text not null default 'needs_confirmation' check(confirmation in ('needs_confirmation','confirmed','incorrect'));
alter table public.application_milestones add column proposed_at timestamptz;
update public.application_milestones set round_id=id,confirmation=case when occurred_at is not null then 'confirmed' else 'needs_confirmation' end;
-- Follow all historical replacement chains without guessing from labels.
with recursive roots as (
 select id, id as root from public.application_milestones where supersedes_id is null
 union all select m.id,r.root from public.application_milestones m join roots r on m.supersedes_id=r.id
) update public.application_milestones m set round_id=r.root from roots r where m.id=r.id;
create function private.initialize_round_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.round_id:=coalesce((select round_id from public.application_milestones where id=new.supersedes_id and user_id=new.user_id and application_id=new.application_id),new.id);
 new.confirmation:=case when new.occurred_at is not null then 'confirmed' else 'needs_confirmation' end;
 return new;
end $$;
create trigger initialize_round_identity before insert on public.application_milestones for each row execute function private.initialize_round_identity();
revoke all on function private.initialize_round_identity() from public,anon,authenticated;
alter function private.record_application_milestone_owned(uuid,uuid,jsonb,text) rename to record_milestone_before_board;
create or replace function private.record_milestone_before_board(owner_id uuid,app_id uuid,payload jsonb,source_kind text)
returns public.application_milestones language plpgsql security definer set search_path='' as $$
declare m public.application_milestones; s jsonb:=payload->'source'; date_value timestamptz; replacement_id uuid;
begin
 perform 1 from public.applications where id=app_id and user_id=owner_id;
 if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-'supersedesId'-'eventKey'-'kind'-'label'-'occurredAt'-'phase'-'source'<>'{}'::jsonb
  or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(trim(coalesce(payload->>'eventKey',''))) not between 1 and 200
  or jsonb_typeof(payload->'label') is distinct from 'string' or length(trim(coalesce(payload->>'label',''))) not between 1 and 300
  or coalesce(payload->>'kind','') not in ('submitted','recruiter_call','technical_round','interview','offer','rejected','withdrawn')
  or coalesce(payload->>'phase','') not in ('scheduled','completed','received','cancelled')
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
create function private.record_application_milestone_owned(owner_id uuid,app_id uuid,payload jsonb,source_kind text) returns public.application_milestones language plpgsql security definer set search_path='' as $$
declare m public.application_milestones;category text:=coalesce(payload->>'practiceCategory','general');zone text:=coalesce(payload->>'timeZone','UTC');proposal timestamptz;
begin
 if category not in ('general','coding','systems','behavioral','sql','ml') or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'Invalid round category or timezone' using errcode='22023';end if;
 if payload ? 'proposedAt' and payload->'proposedAt'<>'null'::jsonb then
  if payload->>'proposedAt' !~ '^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$' then raise exception 'Proposed time needs timezone' using errcode='22023';end if;
  proposal:=(payload->>'proposedAt')::timestamptz;
 end if;
 select * into m from public.application_milestones where user_id=owner_id and event_key=payload->>'eventKey';
 if found and (m.practice_category<>category or m.time_zone<>zone or m.proposed_at is distinct from proposal) then raise exception 'Round retry changed' using errcode='40001';end if;
 m:=private.record_milestone_before_board(owner_id,app_id,payload-array['practiceCategory','timeZone','proposedAt'],source_kind);
 update public.application_milestones set practice_category=category,time_zone=zone,proposed_at=proposal where id=m.id returning * into m;
 return m;
end $$;
revoke all on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function private.record_application_milestone_owned(uuid,uuid,jsonb,text) to service_role;

-- Store round-specific tasks in the existing plan/session ledger. The plan's
-- application version still fences atomic completion across all of its rounds.
create function private.sync_round_preparation(app_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications;p public.preparation_plans;m public.application_milestones;tasks jsonb;task jsonb;matches integer;root uuid;zone text;
begin
 select * into a from public.applications where id=app_id for update;
 if not found or private.work_is_stopped(a.user_id,a.id) then return;end if;
 zone:=coalesce((select search#>>'{quietMode,timezone}' from public.preferences where user_id=a.user_id),'UTC');
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then zone:='UTC';end if;
 select * into p from public.preparation_plans where application_id=a.id for update;
 if not found then
  if not exists(select 1 from public.application_milestones x where x.application_id=a.id and x.phase='scheduled' and x.confirmation='confirmed' and x.kind in ('recruiter_call','technical_round','interview') and not exists(select 1 from public.application_milestones y where y.supersedes_id=x.id)) then return;end if;
  insert into public.preparation_plans(user_id,application_id,plan) values(a.user_id,a.id,jsonb_build_object('applicationId',a.job_id,'deadline',jsonb_build_object('date',null,'stage','Interview','status','needs_confirmation'),'tasks','[]'::jsonb,'guides','[]'::jsonb,'warnings','[]'::jsonb,'roundLinked',true)) returning * into p;
 end if;
 tasks:=coalesce(p.plan->'tasks','[]');
 -- Attach legacy work only to one exact-date current round, preserving task IDs.
 select count(*),(array_agg(x.round_id))[1] into matches,root from public.application_milestones x
 where x.application_id=a.id and x.kind in ('recruiter_call','technical_round','interview') and x.phase='scheduled' and x.confirmation='confirmed'
 and (x.occurred_at at time zone zone)::date::text=p.plan#>>'{deadline,date}'
 and not exists(select 1 from public.application_milestones y where y.supersedes_id=x.id);
 if matches=1 then select coalesce(jsonb_agg(case when value ? 'roundId' then value else value||jsonb_build_object('roundId',root) end),'[]') into tasks from jsonb_array_elements(tasks);end if;
 for m in select x.* from public.application_milestones x where x.application_id=a.id and x.kind in ('recruiter_call','technical_round','interview') and x.phase='scheduled' and x.confirmation='confirmed' and not exists(select 1 from public.application_milestones y where y.supersedes_id=x.id) order by x.id loop
  if not exists(select 1 from jsonb_array_elements(tasks) t where t->>'roundId'=m.round_id::text) then
   for task in select value from jsonb_array_elements('[{"key":"application","title":"Review your application","detail":"Review the resume and answers used for this application.","minutes":20},{"key":"practice","title":"Practice for this round","detail":"Use the confirmed round scope and your own experience.","minutes":30},{"key":"questions","title":"Prepare questions for the team","detail":"Write questions about the team and role.","minutes":15},{"key":"logistics","title":"Check interview logistics","detail":"Check the confirmed time, timezone and meeting details.","minutes":15}]'::jsonb) loop
    tasks:=tasks||jsonb_build_array(task||jsonb_build_object('id',m.round_id::text||':'||(task->>'key'),'roundId',m.round_id,'completed',false));
   end loop;
  end if;
 end loop;
 update public.preparation_plans set plan=jsonb_set(plan,'{tasks}',tasks),version=version+1,updated_at=now() where application_id=a.id;
end $$;
revoke all on function private.sync_round_preparation(uuid) from public,anon,authenticated;
create function private.round_preparation_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.sync_round_preparation(new.application_id);return new;end $$;
revoke all on function private.round_preparation_changed() from public,anon,authenticated;
create trigger round_preparation_changed after insert or update on public.application_milestones for each row execute function private.round_preparation_changed();
-- Replanning must not discard credited round tasks.
create function private.preserve_round_tasks() returns trigger language plpgsql security definer set search_path='' as $$
declare t jsonb;
begin
 if exists(select 1 from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) o where o?'roundId') and exists(select 1 from jsonb_array_elements(coalesce(new.plan->'tasks','[]')) n where not n?'roundId' and not exists(select 1 from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) o where o->>'id'=n->>'id')) then raise exception 'Update linked round preparation instead of rebuilding a separate deadline' using errcode='22023';end if;
 for t in select value from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) where value ? 'roundId' loop
  if not exists(select 1 from jsonb_array_elements(coalesce(new.plan->'tasks','[]')) n where n->>'id'=t->>'id') then new.plan:=jsonb_set(new.plan,'{tasks}',coalesce(new.plan->'tasks','[]')||jsonb_build_array(t));end if;
 end loop;
 new.plan:=jsonb_set(new.plan,'{tasks}',(select coalesce(jsonb_agg(n||coalesce((select jsonb_build_object('roundId',o->'roundId') from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) o where o->>'id'=n->>'id' and o?'roundId' limit 1),'{}')||coalesce((select jsonb_build_object('completed',true,'completedAt',o->'completedAt') from jsonb_array_elements(coalesce(old.plan->'tasks','[]')) o where o->>'id'=n->>'id' and o->>'completed'='true' limit 1),'{}')),'[]') from jsonb_array_elements(coalesce(new.plan->'tasks','[]')) n));
 return new;
end $$;
revoke all on function private.preserve_round_tasks() from public,anon,authenticated;
create trigger preserve_round_tasks before update on public.preparation_plans for each row execute function private.preserve_round_tasks();

create function private.action_board_items(owner_id uuid) returns setof jsonb language sql stable security definer set search_path='' as $$
 with items as (
 select jsonb_build_object('key','application:'||a.id||':'||a.revision||':'||i.kind,'kind',i.kind,'sourceId',a.id,'version',a.revision::text,'createdAt',i.created_at,'applicationId',a.id,'company',j.employer->>'company','role',j.employer->>'title','reason',i.reason,'questions',coalesce(a.draft->'questions','[]'),'href','/applications/?application='||a.id||'&tab=Documents','requiresReview',i.kind='review_application','canAccept',i.kind='review_application','canReject',i.kind='review_application') as item
 from public.action_inbox i join public.applications a on a.id=i.application_id and a.user_id=i.user_id join public.jobs j on j.id=a.job_id
 where i.user_id=owner_id and i.resolved_at is null and i.available_at<=now() and (i.kind='check_submission' or not private.work_is_stopped(owner_id,a.id))
 union all
 select jsonb_build_object('key','answer:'||x.id||':'||md5(to_jsonb(x)::text),'kind',case when lower(trim(x.answer)) in ('','ask me') then 'missing_answer' else 'verify_answer' end,'sourceId',x.id,'version',md5(to_jsonb(x)::text),'createdAt',x.updated_at,'title',x.question,'body',x.answer,'company',x.company_scope,'reason',case when lower(trim(x.answer)) in ('','ask me') then 'Your answer is needed. Open the answer editor to supply it.' else 'This proposed answer has not been verified. Choose whether it may be reused.' end,'href','/profile/?section=agent&answer='||x.id,'canAccept',lower(trim(x.answer)) not in ('','ask me'),'canReject',lower(trim(x.answer)) not in ('','ask me'),'requiresReview',false)
 from public.answer_library x where x.user_id=owner_id and x.verified_at is null and x.provenance='agent'
 union all
 select jsonb_build_object('key','interview:'||m.id,'kind','confirm_interview','sourceId',m.id,'version',m.id::text,'createdAt',m.created_at,'applicationId',a.id,'company',j.employer->>'company','title',m.label,'body',m.source->>'excerpt','proposedAt',m.proposed_at,'timeZone',m.time_zone,'reason','These interview details need confirmation before preparation can be scheduled.','href','/applications/?application='||a.id||'&tab=Interview&round='||m.id,'canAccept',m.proposed_at is not null,'canReject',true,'requiresReview',false)
 from public.application_milestones m join public.applications a on a.id=m.application_id join public.jobs j on j.id=a.job_id
 where m.user_id=owner_id and m.phase='scheduled' and m.kind in ('recruiter_call','technical_round','interview') and m.confirmation='needs_confirmation' and not exists(select 1 from public.application_milestones n where n.supersedes_id=m.id)
 union all
 select jsonb_build_object('key','outreach:'||c.id||':'||md5(jsonb_build_array(c.record->>'message',c.record->>'subject',c.record->>'contact',c.record->>'name',c.record->>'email',c.record->>'linkedin')::text),'kind','review_outreach','sourceId',c.id,'version',c.revision::text,'createdAt',c.updated_at,'title','Review message','company',c.record->>'company','recipient',coalesce(c.record->>'contact',c.record->>'name'),'destination',coalesce(c.record->>'email',c.record->>'linkedin'),'subject',c.record->>'subject','body',c.record->>'message','reason','This prepared message is waiting for your review. Accepting marks it ready for you to send.','href','/referrals/?person='||c.id,'requiresReview',true,'canAccept',true,'canReject',true)
 from public.outreach_contacts c where c.user_id=owner_id and c.deleted_at is null and length(trim(coalesce(c.record->>'message','')))>0 and c.record->>'message' !~ '\[[^]]+\]' and coalesce(c.record->>'status','Not asked') in ('Not asked','Draft','Drafted')
 ) select item||jsonb_build_object('reviewed',r.reviewed_at is not null) from items left join private.action_decision_receipts r on r.user_id=owner_id and r.decision_key=item->>'key'
 where r.response is null order by (item->>'createdAt')::timestamptz,item->>'key'
$$;
revoke all on function private.action_board_items(uuid) from public,anon,authenticated;
create function private.action_board_read(owner_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('items',coalesce((select jsonb_agg(x order by (x->>'createdAt')::timestamptz,x->>'key') from private.action_board_items(owner_id) x),'[]'),
 'holds',coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('href','/applications/?application='||h.application_id||'&tab=Documents','requiresHuman',true)) from public.application_work_holds h where h.user_id=owner_id),'[]'),
 'outreach',coalesce((select jsonb_agg(jsonb_build_object('sourceId',c.id,'response',r.response,'body',c.record->>'message','subject',coalesce(c.record->>'subject',''),'recipient',coalesce(c.record->>'contact',c.record->>'name'))) from public.outreach_contacts c join private.action_decision_receipts r on r.user_id=c.user_id and r.decision_key='outreach:'||c.id||':'||md5(jsonb_build_array(c.record->>'message',c.record->>'subject',c.record->>'contact',c.record->>'name',c.record->>'email',c.record->>'linkedin')::text) where c.user_id=owner_id and c.deleted_at is null and r.response is not null),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(r) order by responded_at desc) from private.action_decision_receipts r where r.user_id=owner_id and r.response is not null),'[]'))
$$;
revoke all on function private.action_board_read(uuid) from public,anon,authenticated;
create function public.read_action_board() returns jsonb language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;return private.action_board_read(auth.uid());end $$;
revoke all on function public.read_action_board() from public,anon;
grant execute on function public.read_action_board() to authenticated;

create function public.respond_action_board(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();item jsonb;prior private.action_response_events;response text:=payload->>'response';key text:=payload->>'key';a public.applications;m public.application_milestones;c public.outreach_contacts;result jsonb;policy text;hold_version integer;
begin
 if owner_id is null then raise exception 'Human sign-in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['key','response','eventKey','policy','expectedVersion']<>'{}' or coalesce(key,'')='' or length(key)>400 or response not in ('review','accept','reject','resume') or response is null or payload->>'eventKey' is null then raise exception 'Invalid human decision' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':action-board',0));
 select * into prior from private.action_response_events where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;
 if found then if prior.request<>payload then raise exception 'Decision retry changed' using errcode='40001';end if;return prior.result;end if;
 if response='resume' then
  select * into a from public.applications where id=key::uuid and user_id=owner_id for update;
  if not found then raise exception 'Owned application missing' using errcode='P0002';end if;
  select version into hold_version from public.application_work_holds where user_id=owner_id and application_id=a.id and resumed_at is null for update;
  if hold_version is null or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or coalesce(payload->>'expectedVersion','') !~ '^[0-9]+$' or hold_version is distinct from (payload->>'expectedVersion')::integer then raise exception 'Work hold changed; reload before resuming' using errcode='40001';end if;
  update public.application_work_holds set resumed_at=now(),version=version+1 where user_id=owner_id and application_id=a.id and resumed_at is null;
  perform private.sync_application_inbox(a.id);
 else
  -- Resolve identity from owned data, not delimiter parsing of caller text.
  select x into item from private.action_board_items(owner_id) x where x->>'key'=key;
  if item is null then raise exception 'Decision changed; reload' using errcode='40001';end if;
  if item->>'kind' in ('review_application','resolve_blocker','check_submission') then perform 1 from public.applications where user_id=owner_id and id=(item->>'sourceId')::uuid for update;
  elsif item->>'kind' in ('verify_answer','missing_answer') then perform 1 from public.answer_library where user_id=owner_id and id=(item->>'sourceId')::uuid for update;
  elsif item->>'kind'='confirm_interview' then perform 1 from public.application_milestones where user_id=owner_id and id=(item->>'sourceId')::uuid for update;
  elsif item->>'kind'='review_outreach' then perform 1 from public.outreach_contacts where user_id=owner_id and id=item->>'sourceId' for update;
  end if;
  select x into item from private.action_board_items(owner_id) x where x->>'key'=key;
  if item is null then raise exception 'Decision changed; reload before responding' using errcode='40001';end if;
  if response='review' then
   if item->>'requiresReview'<>'true' then raise exception 'Review not required' using errcode='22023';end if;
   insert into private.action_decision_receipts(user_id,decision_key,source_kind,source_id,reviewed_at) values(owner_id,key,item->>'kind',item->>'sourceId',now()) on conflict(user_id,decision_key) do update set reviewed_at=excluded.reviewed_at;
  else
   if (response='accept' and item->>'canAccept'<>'true') or (response='reject' and item->>'canReject'<>'true') then raise exception 'Use the owning editor for this action' using errcode='22023';end if;
   if response='accept' and item->>'requiresReview'='true' and item->>'reviewed'<>'true' then raise exception 'Review this exact version first' using errcode='42501';end if;
   if item->>'kind'='review_application' then
    select * into a from public.applications where id=(item->>'sourceId')::uuid and user_id=owner_id;
    if response='accept' then perform private.approve_application(a.id,a.revision);
    else
     -- Changing revision invalidates old exact-version approval, without deleting history.
     update public.applications set draft=jsonb_set(draft,'{questionsReviewed}','false'::jsonb),status='Draft' where id=a.id;
     insert into public.application_work_holds(user_id,application_id) values(owner_id,a.id) on conflict(application_id) do update set stopped_at=now(),resumed_at=null,version=public.application_work_holds.version+1;
     update private.backend_jobs set status='cancelled',version=version+1,finished_at=now(),lease_token=null,lease_expires_at=null,updated_at=now() where user_id=owner_id and kind='application_submit' and input->>'applicationId'=a.id::text and status='queued';
     update public.action_inbox set resolved_at=now(),resolution='work_stopped' where user_id=owner_id and application_id=a.id and resolved_at is null and kind<>'check_submission';
    end if;
   elsif item->>'kind'='verify_answer' and response='accept' then
    policy:=payload->>'policy';if policy is null or policy not in ('ask','auto') then raise exception 'Choose answer reuse permission' using errcode='22023';end if;
    update public.answer_library set verified_at=now(),provenance='user',autofill_policy=policy,updated_at=now() where id=(item->>'sourceId')::uuid and user_id=owner_id;
   elsif item->>'kind'='confirm_interview' then
    select * into m from public.application_milestones where id=(item->>'sourceId')::uuid and user_id=owner_id;
    if response='accept' then
     perform private.record_application_milestone_owned(owner_id,m.application_id,jsonb_build_object('eventKey','board:'||(payload->>'eventKey'),'kind',m.kind,'label',m.label,'phase',m.phase,'occurredAt',m.proposed_at,'supersedesId',m.id,'practiceCategory',m.practice_category,'timeZone',m.time_zone,'source',jsonb_build_object('kind','user','timestampConfirmed',true,'note','Confirmed in Action Board')),'user');
    else update public.application_milestones set confirmation='incorrect' where id=m.id;end if;
   end if;
   insert into private.action_decision_receipts(user_id,decision_key,source_kind,source_id,response,responded_at) values(owner_id,key,item->>'kind',item->>'sourceId',response,now()) on conflict(user_id,decision_key) do update set response=excluded.response,responded_at=excluded.responded_at;
  end if;
 end if;
 result:=jsonb_build_object('response',response,'key',key,'saved',true);
 insert into private.action_response_events values(owner_id,(payload->>'eventKey')::uuid,payload,result);
 return result;
end $$;
revoke all on function public.respond_action_board(jsonb) from public,anon;
grant execute on function public.respond_action_board(jsonb) to authenticated;

-- The existing planner snapshot is also the MCP snapshot.
alter function private.preparation_planner_read_owned(uuid) rename to preparation_planner_before_board;
create function private.preparation_planner_read_owned(owner_id uuid) returns jsonb language sql security definer set search_path='' as $$
 select private.preparation_planner_before_board(owner_id)||jsonb_build_object('holds',coalesce((select jsonb_agg(to_jsonb(h)) from public.application_work_holds h where h.user_id=owner_id and resumed_at is null),'[]'))
$$;
revoke all on function private.preparation_planner_read_owned(uuid) from public,anon,authenticated;
grant execute on function private.preparation_planner_read_owned(uuid) to service_role;

alter function public.runner_submission_transition(text,text,jsonb,jsonb,jsonb) rename to runner_submission_before_board;
create function public.runner_submission_transition(credential_hash text,operation text,p_payload jsonb,expected_context jsonb default null,execution_authorization jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if operation in ('claim','start') then
  perform 1 from public.applications where user_id=c.user_id and id=(p_payload->>'applicationId')::uuid for update;
  if private.work_is_stopped(c.user_id,(p_payload->>'applicationId')::uuid) then raise exception 'Agent work stopped' using errcode='42501';end if;
 end if;
 return public.runner_submission_before_board(credential_hash,operation,p_payload,expected_context,execution_authorization);
end $$;
revoke all on function public.runner_submission_transition(text,text,jsonb,jsonb,jsonb),public.runner_submission_before_board(text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.runner_submission_transition(text,text,jsonb,jsonb,jsonb) to service_role;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to action_board_previous;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;app_id uuid;result jsonb;path text;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if operation='actions.board.read' then
  if not 'workspace:read'=any(c.scopes) then raise exception 'Read scope required' using errcode='42501';end if;
  if payload<>'{}' then raise exception 'No board arguments allowed' using errcode='22023';end if;
  return private.action_board_read(c.user_id);
 end if;
 if operation='preparation.read' then
  result:=private.action_board_previous(credential_hash,operation,payload);
  return result||jsonb_build_object('rounds',coalesce((select jsonb_agg(to_jsonb(m) order by m.id) from public.application_milestones m where m.user_id=c.user_id and m.application_id=(payload->>'applicationId')::uuid and not exists(select 1 from public.application_milestones n where n.supersedes_id=m.id)),'[]'));
 end if;
 if operation='human.request' then
  result:=private.action_board_previous(credential_hash,operation,payload);
  if payload->>'action'='verify-answer' then path:='/profile/?section=agent&answer='||(payload->>'recordId');
  elsif payload->>'action' in ('approve-application','resolve-submission') then path:='/applications/?application='||(payload->>'recordId')||'&tab=Documents';
  elsif payload->>'action'='send-outreach' and payload->>'recordId' is not null then
   if not exists(select 1 from public.outreach_contacts where user_id=c.user_id and id=payload->>'recordId' and deleted_at is null) then raise exception 'Owned outreach required' using errcode='P0002';end if;
   path:='/referrals/?person='||(payload->>'recordId');
  end if;
  return case when path is null then result else result||jsonb_build_object('url','https://wcia013twe.github.io/codex-automated-job-board'||path) end;
 end if;
 if operation in ('drafts.prepare','preparation.update','preparation.save','submission.claim','submission.start') then
  app_id:=nullif(payload->>'applicationId','')::uuid;
  if app_id is null and payload ? 'jobId' then select id into app_id from public.applications where user_id=c.user_id and job_id=payload->>'jobId' for update;end if;
  if app_id is not null then
   perform 1 from public.applications where user_id=c.user_id and id=app_id for update;
   if private.work_is_stopped(c.user_id,app_id) then raise exception 'Agent work stopped; only the human can resume' using errcode='42501';end if;
  end if;
 end if;
 return private.action_board_previous(credential_hash,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb),private.action_board_previous(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
-- Notify existing subscriptions without publishing private decision bodies.
create trigger workspace_changed after insert or update or delete on public.application_work_holds for each row execute function private.workspace_changed();
create function private.board_receipt_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from auth.users where id=new.user_id) then insert into public.workspace_changes(user_id) values(new.user_id) on conflict(user_id) do update set version=public.workspace_changes.version+1;end if;return new;
end $$;
revoke all on function private.board_receipt_changed() from public,anon,authenticated;
create trigger board_receipt_changed after insert or update on private.action_decision_receipts for each row execute function private.board_receipt_changed();
do $$ declare app_id uuid;begin for app_id in select distinct application_id from public.application_milestones loop perform private.sync_round_preparation(app_id);end loop;end $$;
-- Queue replays cannot silently return an actionable job after a human stop.
alter function private.queue_application_job(uuid,uuid,jsonb) rename to queue_application_before_board;
create function private.queue_application_job(owner_id uuid,bound_connection uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare app_id uuid;
begin
 select a.id into app_id from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id and j.canonical_url=payload#>>'{posting,url}' for update of a;
 if app_id is not null and private.work_is_stopped(owner_id,app_id) then raise exception 'Agent work stopped; resume explicitly first' using errcode='42501';end if;
 return private.queue_application_before_board(owner_id,bound_connection,payload);
end $$;
revoke all on function private.queue_application_job(uuid,uuid,jsonb) from public,anon,authenticated;
-- Fence execution before runner prefill as well as claim and click.
alter function public.runner_submission_context(text,uuid) rename to runner_context_before_board;
create function public.runner_submission_context(credential_hash text,app_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 perform 1 from public.applications where user_id=c.user_id and id=app_id for update;
 if private.work_is_stopped(c.user_id,app_id) then raise exception 'Agent work stopped' using errcode='42501';end if;
 return public.runner_context_before_board(credential_hash,app_id);
end $$;
revoke all on function public.runner_submission_context(text,uuid),public.runner_context_before_board(text,uuid) from public,anon,authenticated;
grant execute on function public.runner_submission_context(text,uuid),private.work_is_stopped(uuid,uuid),private.action_board_read(uuid),private.queue_application_job(uuid,uuid,jsonb) to service_role;
-- Agent edits cannot silently turn a declined outreach draft into a new task.
create function private.guard_declined_outreach() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.record->>'message' is distinct from old.record->>'message' or new.record->>'subject' is distinct from old.record->>'subject')
 and auth.uid() is distinct from old.user_id and exists(select 1 from private.action_decision_receipts where user_id=old.user_id and source_kind='review_outreach' and source_id=old.id and decision_key='outreach:'||old.id||':'||md5(jsonb_build_array(old.record->>'message',old.record->>'subject',old.record->>'contact',old.record->>'name',old.record->>'email',old.record->>'linkedin')::text) and response='reject') then
 raise exception 'Outreach declined; human must explicitly start new work' using errcode='42501';end if;
 return new;
end $$;
revoke all on function private.guard_declined_outreach() from public,anon,authenticated;
create trigger guard_declined_outreach before update on public.outreach_contacts for each row execute function private.guard_declined_outreach();
-- New owned records participate in the existing reset and reset write fence.
alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_board;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['private.action_response_events','private.action_decision_receipts','public.application_work_holds']::text[]||private.workspace_reset_tables_before_board()
$$;
revoke all on function private.workspace_reset_tables(),private.workspace_reset_tables_before_board() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on private.action_response_events for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on private.action_decision_receipts for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on public.application_work_holds for each row execute function private.workspace_reset_write_guard();
commit;
