begin;
-- Extend the existing decision ledger; task text and completion stay on the tracker.
-- Never reinterpret legacy Done/Dismissed receipts as agent authorization.
alter table private.action_decision_receipts
 add column pipeline_enabled boolean not null default false,
 add column resumed_at timestamptz,
 add column work_state text check(work_state in ('started','completed','blocked','uncertain')),
 add column work_version integer not null default 1,
 add column work_connection_id uuid references private.agent_connections(id) on delete set null,
 add column work_note text,
 add column resolution_note text,
 add column source_summary jsonb;

create function private.tracker_action_key(owner_id uuid,record_id uuid) returns text
language sql stable security definer set search_path='' as $$
 select 'imported:'||j.id||':'||md5(j.record::text)||coalesce(':r'||md5((select max(r.resumed_at)::text from private.action_decision_receipts r where r.user_id=owner_id and r.source_kind='imported_action' and r.source_id=j.id::text and r.pipeline_enabled)), '')
 from public.imported_jobs j where j.user_id=owner_id and j.id=record_id
$$;
create function private.tracker_action_stopped(owner_id uuid,record_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.action_decision_receipts r where r.user_id=owner_id and r.source_kind='imported_action' and r.source_id=record_id and r.pipeline_enabled and r.response='reject' and r.resumed_at is null)
$$;
revoke all on function private.tracker_action_key(uuid,uuid),private.tracker_action_stopped(uuid,text) from public,anon,authenticated;

alter function private.action_board_items(uuid) rename to action_board_items_before_change_pipeline;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select x from private.action_board_items_before_change_pipeline(owner_id) x where x->>'kind'<>'imported_action'
 union all
 select x||jsonb_build_object('key',private.tracker_action_key(owner_id,(x->>'sourceId')::uuid),'version',private.tracker_action_key(owner_id,(x->>'sourceId')::uuid))
 from private.action_board_items_before_change_pipeline(owner_id) x
 where x->>'kind'='imported_action' and not private.tracker_action_stopped(owner_id,x->>'sourceId')
 and not exists(select 1 from private.action_decision_receipts r where r.user_id=owner_id and r.decision_key=private.tracker_action_key(owner_id,(x->>'sourceId')::uuid) and r.pipeline_enabled and r.response is not null)
$$;
revoke all on function private.action_board_items(uuid),private.action_board_items_before_change_pipeline(uuid) from public,anon,authenticated;

alter function private.action_board_read(uuid) rename to action_board_read_before_change_pipeline;
create function private.action_board_read(owner_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select private.action_board_read_before_change_pipeline(owner_id)||jsonb_build_object('trackerWork',coalesce((
 select jsonb_agg(jsonb_build_object('key',r.decision_key,'sourceId',r.source_id,'version',r.work_version,'company',coalesce(r.source_summary->>'company',j.record->>'company'),'role',coalesce(r.source_summary->>'role',j.record->>'title'),'action',coalesce(r.source_summary->>'action',j.record->>'nextAction'),'note',r.work_note,
 'state',case when r.response='reject' then 'rejected' when r.work_state='completed' then 'completed' when r.decision_key<>private.tracker_action_key(owner_id,j.id) or j.record->>'needsAction'<>'true' or coalesce(j.record->>'archived','false')='true' then 'superseded' else coalesce(r.work_state,'approved') end,
 'observedOutcome',r.work_state,'href','/applications/?application=import:'||j.id||'&tab=Overview','respondedAt',r.responded_at,'connectionId',r.work_connection_id,'anchor','tracker-'||md5(r.decision_key),'humanActionHref','/needs-you/#tracker-'||md5(r.decision_key)) order by r.responded_at desc)
 from private.action_decision_receipts r join public.imported_jobs j on j.user_id=r.user_id and j.id::text=r.source_id
 where r.user_id=owner_id and r.source_kind='imported_action' and r.pipeline_enabled and r.response is not null and r.resumed_at is null),'[]'::jsonb))
$$;
revoke all on function private.action_board_read(uuid),private.action_board_read_before_change_pipeline(uuid) from public,anon,authenticated;

-- Intercept tracker decisions. Other action types retain their existing validators.
alter function public.respond_action_board(jsonb) rename to respond_action_board_before_change_pipeline;
alter function public.respond_action_board_before_change_pipeline(jsonb) set schema private;
revoke all on function private.respond_action_board_before_change_pipeline(jsonb) from public,anon,authenticated;
create function public.respond_action_board(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); k text:=payload->>'key'; response text:=payload->>'response'; prior private.action_response_events; r private.action_decision_receipts; item jsonb; result jsonb;
begin
 if response not in ('resume_tracker','stop_tracker') and coalesce(k,'') not like 'imported:%' then return private.respond_action_board_before_change_pipeline(payload);end if;
 if owner_id is null then raise exception 'Human sign-in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['key','response','eventKey','input']<>'{}' or length(coalesce(k,'')) not between 1 and 400 or response is null or response not in ('accept','reject','resume_tracker','stop_tracker') or payload->>'eventKey' is null then raise exception 'Invalid tracker decision' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':action-board',0));
 select * into prior from private.action_response_events where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;
 if found then if prior.request<>payload then raise exception 'Decision retry changed' using errcode='40001';end if;return prior.result;end if;
 if response in ('resume_tracker','stop_tracker') then
  select * into r from private.action_decision_receipts where user_id=owner_id and decision_key=k and source_kind='imported_action' and pipeline_enabled and resumed_at is null for update;
  if not found or (response='stop_tracker' and (r.response<>'accept' or r.work_state='completed')) or (response='resume_tracker' and r.response<>'reject' and coalesce(r.work_state,'') not in ('blocked','uncertain')) then raise exception 'Tracker work changed; reload' using errcode='40001';end if;
  if response='resume_tracker' then
   if r.work_state in ('blocked','uncertain') and (jsonb_typeof(payload->'input') is distinct from 'object' or (payload->'input')-array['note','confirmed']<>'{}' or payload#>'{input,confirmed}' is distinct from 'true'::jsonb or length(trim(coalesce(payload#>>'{input,note}',''))) not between 1 and 1000) then raise exception 'Check the blocker or outcome and save a verification note first' using errcode='22023';end if;
   update private.action_decision_receipts set resumed_at=now(),resolution_note=nullif(payload#>>'{input,note}',''),work_version=work_version+1 where user_id=owner_id and decision_key=k;
  else
   update private.action_decision_receipts set response='reject',responded_at=now(),work_version=work_version+1 where user_id=owner_id and decision_key=k;
  end if;
 else
  select x into item from private.action_board_items(owner_id) x where x->>'key'=k and x->>'kind'='imported_action';
  if item is null then raise exception 'Decision changed; reload' using errcode='40001';end if;
  insert into private.action_decision_receipts(user_id,decision_key,source_kind,source_id,response,responded_at,pipeline_enabled,source_summary)
   values(owner_id,k,'imported_action',item->>'sourceId',response,now(),true,jsonb_build_object('company',item->>'company','role',item->>'role','action',item->>'reason'))
   on conflict(user_id,decision_key) do update set response=excluded.response,responded_at=excluded.responded_at,pipeline_enabled=true,source_summary=excluded.source_summary;
 end if;
 if response in ('reject','stop_tracker') then
  update private.backend_jobs b set status='cancelled',version=version+1,finished_at=now(),lease_token=null,lease_expires_at=null,updated_at=now()
   where b.user_id=owner_id and b.kind='application_submit' and b.status='queued' and exists(select 1 from public.applications a join public.jobs j on j.id=a.job_id join public.imported_jobs i on i.user_id=a.user_id and i.record->>'url'=j.canonical_url where a.user_id=owner_id and b.input->>'applicationId'=a.id::text and private.tracker_action_stopped(owner_id,i.id::text));
  update public.applications a set draft=jsonb_set(a.draft,'{questionsReviewed}','false'::jsonb),status='Draft'
   where a.user_id=owner_id and a.status='Approved' and exists(select 1 from public.jobs j join public.imported_jobs i on i.record->>'url'=j.canonical_url where j.id=a.job_id and i.user_id=owner_id and private.tracker_action_stopped(owner_id,i.id::text));
 end if;
 result:=jsonb_build_object('saved',true,'key',k,'response',response);
 insert into private.action_response_events values(owner_id,(payload->>'eventKey')::uuid,payload,result);
 return result;
end $$;
revoke all on function public.respond_action_board(jsonb) from public,anon;
grant execute on function public.respond_action_board(jsonb) to authenticated;

-- Fence ordinary tracker writes. Completion is only the scoped reporting operation below.
alter function private.update_imported_job_owned(uuid,jsonb) rename to update_imported_job_before_change_pipeline;
create function private.update_imported_job_owned(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.imported_jobs; r private.action_decision_receipts;
begin
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':action-board',0));
 if auth.uid() is distinct from owner_id then
  if private.tracker_action_stopped(owner_id,payload->>'id') then raise exception 'Human stopped this tracker action' using errcode='42501';end if;
  select * into j from public.imported_jobs where user_id=owner_id and id=(payload->>'id')::uuid;
  select * into r from private.action_decision_receipts where user_id=owner_id and decision_key=private.tracker_action_key(owner_id,j.id) and pipeline_enabled and response='accept' and resumed_at is null and work_state is distinct from 'completed';
  if found and exists(select 1 from jsonb_each(payload->'changes') c where c.key in ('needsAction','nextAction','actionDate') and c.value is distinct from j.record->c.key) then raise exception 'Report approved tracker action progress before changing its task' using errcode='42501';end if;
 end if;
 return private.update_imported_job_before_change_pipeline(owner_id,payload);
end $$;
revoke all on function private.update_imported_job_owned(uuid,jsonb),private.update_imported_job_before_change_pipeline(uuid,jsonb) from public,anon,authenticated;

-- Propagate tracker rejection to native application queues, draft writes and execution fences.
alter function private.work_is_stopped(uuid,uuid) rename to work_is_stopped_before_change_pipeline;
create function private.work_is_stopped(owner_id uuid,app_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.work_is_stopped_before_change_pipeline(owner_id,app_id) or exists(
 select 1 from public.applications a join public.jobs j on j.id=a.job_id join public.imported_jobs i on i.user_id=a.user_id and i.record->>'url'=j.canonical_url
 where a.user_id=owner_id and a.id=app_id and private.tracker_action_stopped(owner_id,i.id::text))
$$;
revoke all on function private.work_is_stopped(uuid,uuid),private.work_is_stopped_before_change_pipeline(uuid,uuid) from public,anon,authenticated;
grant execute on function private.work_is_stopped(uuid,uuid) to service_role;

alter function private.queue_application_job(uuid,uuid,jsonb) rename to queue_application_before_change_pipeline;
create function private.queue_application_job(owner_id uuid,bound_connection uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.imported_jobs j where j.user_id=owner_id and j.record->>'url'=payload#>>'{posting,url}' and private.tracker_action_stopped(owner_id,j.id::text)) then raise exception 'Human stopped work on this tracker item' using errcode='42501';end if;
 return private.queue_application_before_change_pipeline(owner_id,bound_connection,payload);
end $$;
revoke all on function private.queue_application_job(uuid,uuid,jsonb),private.queue_application_before_change_pipeline(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.queue_application_job(uuid,uuid,jsonb) to service_role;

create function private.record_tracker_action_progress(owner_id uuid,connection_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.action_decision_receipts; prior private.action_response_events; j public.imported_jobs; result jsonb; req jsonb:=jsonb_build_object('operation','actions.tracker.progress','payload',payload); stage text:=payload->>'stage'; current_source boolean; v integer;
begin
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['key','expectedVersion','stage','note','eventKey']<>'{}' or not payload ?& array['key','expectedVersion','stage','eventKey'] or length(coalesce(payload->>'key','')) not between 1 and 400 or stage not in ('started','completed','blocked','uncertain') or stage is null or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion') !~ '^[1-9][0-9]{0,8}$' or (stage<>'started' and length(trim(coalesce(payload->>'note',''))) not between 1 and 1000) or length(coalesce(payload->>'note',''))>1000 then raise exception 'Current tracker decision, progress stage and bounded outcome note required' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':action-board',0));
 select * into prior from private.action_response_events where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;
 if found then if prior.request<>req then raise exception 'Progress retry changed' using errcode='40001';end if;return prior.result;end if;
 select * into r from private.action_decision_receipts where user_id=owner_id and decision_key=payload->>'key' and source_kind='imported_action' and pipeline_enabled for update;
 if not found or r.work_version<>(payload->>'expectedVersion')::integer or r.resumed_at is not null or r.work_state='completed' then raise exception 'Tracker decision changed; read the board again' using errcode='40001';end if;
 select * into j from public.imported_jobs where user_id=owner_id and id::text=r.source_id for update;
 if not found then raise exception 'Owned tracker record missing' using errcode='P0002';end if;
 current_source:=r.decision_key=private.tracker_action_key(owner_id,j.id) and j.record->>'needsAction'='true' and coalesce(j.record->>'archived','false')<>'true' and coalesce(j.record->>'status','') not in ('REJECTED','WITHDRAWN','CLOSED') and not private.tracker_action_stopped(owner_id,r.source_id);
 current_source:=coalesce(current_source,false);
 if stage='started' then
  if r.response<>'accept' or not current_source or r.work_connection_id is not null then raise exception 'Current human approval required; another agent may own this work' using errcode='42501';end if;
 else
  if r.work_connection_id is distinct from connection_id or r.work_state is null then raise exception 'Only the agent that started this work may report its outcome' using errcode='42501';end if;
 end if;
 update private.action_decision_receipts set work_state=stage,work_version=work_version+1,work_connection_id=connection_id,work_note=nullif(trim(payload->>'note'),'') where user_id=owner_id and decision_key=r.decision_key;
 if stage='completed' and current_source and r.response='accept' then
  select version into v from private.tracker_import_versions where user_id=owner_id;
  perform private.update_imported_job_before_change_pipeline(owner_id,jsonb_build_object('id',j.id,'expectedVersion',coalesce(v,0),'eventKey','progress:'||(payload->>'eventKey'),'changes',jsonb_build_object('needsAction',false)));
 end if;
 -- A stopped or changed source can still receive an already-started observed outcome;
 -- it never clears the new task, lifts a hold or manufactures a submission receipt.
 result:=jsonb_build_object('key',r.decision_key,'state',stage,'version',r.work_version+1,'sourceCurrent',current_source,'verifiedSubmission',false);
 insert into private.action_response_events values(owner_id,(payload->>'eventKey')::uuid,req,result);
 return result;
end $$;
revoke all on function private.record_tracker_action_progress(uuid,uuid,jsonb) from public,anon,authenticated;
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_tracker_progress;
alter function public.agent_dispatch_before_tracker_progress(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_tracker_progress(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'actions.tracker.progress' then return private.agent_dispatch_before_tracker_progress(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_tracker_progress(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not array['workspace:read','tracking:write','activity:write']::text[]<@c.scopes then raise exception 'Tracker progress scopes required' using errcode='42501';end if;
 return private.record_tracker_action_progress(c.user_id,c.id,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

-- Human decisions, native approvals and AI Apply join the SAME pointer-only feed.
create function private.emit_action_pipeline_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text;id text;key text;response text;source_kind text;decision_key text;p jsonb;owner_id uuid;app uuid;
begin
 owner_id:=new.user_id;
 if tg_table_name='action_decision_receipts' then
  if new.response is null then return new;end if;
  if tg_op='UPDATE' and new.response is not distinct from old.response and new.resumed_at is not distinct from old.resumed_at and new.pipeline_enabled is not distinct from old.pipeline_enabled then return new;end if;
  key:=new.decision_key;id:=new.source_id;response:=case when new.resumed_at is not null then 'resume' else new.response end;source_kind:=new.source_kind;
 elsif tg_table_name='approvals' then
  if auth.uid() is distinct from owner_id then return new;end if;
  app:=new.application_id;id:=app::text;key:='application:'||app||':'||new.revision||':review_application';response:='accept';source_kind:='review_application';
 elsif tg_table_name='application_work_holds' then
  if tg_op<>'UPDATE' or old.resumed_at is not null or new.resumed_at is null then return new;end if;
  app:=new.application_id;id:=app::text;key:='hold:'||app||':'||new.version;response:='resume';source_kind:='application_work_hold';
 elsif tg_table_name='backend_jobs' then
  if new.kind<>'application_submit' or new.status<>'queued' then return new;end if;
  k:='muse.application_requested';id:=new.id::text;key:='muse-feed:application-request:'||new.id;
  p:=jsonb_build_object('entity','backend_job','recordId',id,'applicationId',new.input->>'applicationId','version',new.version,'status',new.status,'text','AI Apply requested. Read the existing job and current application; preparation is not submission approval.');
 end if;
 if k is null then
  k:='muse.action_decision';decision_key:=key;key:='muse-feed:decision:'||md5(key)||':'||response;
  p:=jsonb_build_object('entity','action_board','recordId',id,'decisionKey',decision_key,'sourceKind',source_kind,'response',response,'text','Human action decision saved. Read the current board and exact source before continuing or stopping work.');
 end if;
 insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload) values(owner_id,app,key,k,'system',p) on conflict(user_id,event_key) do nothing;
 return new;
end $$;
revoke all on function private.emit_action_pipeline_change() from public,anon,authenticated;
create trigger pipeline_board_decision after insert or update on private.action_decision_receipts for each row execute function private.emit_action_pipeline_change();
create trigger pipeline_native_approval after insert on public.approvals for each row execute function private.emit_action_pipeline_change();
create trigger pipeline_native_resume after update on public.application_work_holds for each row execute function private.emit_action_pipeline_change();
create trigger pipeline_ai_apply after insert on private.backend_jobs for each row execute function private.emit_action_pipeline_change();

drop index public.muse_changes_pending;
create index muse_changes_pending on public.activity_events(user_id,occurred_at,id) where actor='system' and kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed','muse.schedule_changed','muse.action_decision','muse.application_requested');
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public') and p.pronargs=3 and p.prosrc like '%Owned change events required%' and p.prosrc like '%changes.read%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one Muse feed implementation';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$'muse.schedule_changed'$old$,$new$'muse.schedule_changed','muse.action_decision','muse.application_requested'$new$);
 changed:=replace(changed,$old$'summary',e.payload->'text'$old$,$new$'summary',e.payload->'text','decisionKey',e.payload->'decisionKey','sourceKind',e.payload->'sourceKind','response',e.payload->'response','applicationId',e.payload->'applicationId'$new$);
 if changed=definition then raise exception 'Expected feed allowlist unavailable';end if;execute changed;
 definition:=pg_get_functiondef('public.agent_pending_count(uuid)'::regprocedure);
 changed:=replace(definition,$old$'muse.schedule_changed'$old$,$new$'muse.schedule_changed','muse.action_decision','muse.application_requested'$new$);
 if changed=definition then raise exception 'Expected watch allowlist unavailable';end if;execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
