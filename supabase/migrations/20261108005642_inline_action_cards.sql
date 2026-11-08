begin;
alter function private.action_board_items(uuid) rename to action_board_items_before_inline_cards;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select x||jsonb_build_object(
  'canAccept',true,'canReject',true,
  'questions',coalesce(a.draft->'questions',x->'questions','[]'::jsonb),
  'coverLetter',a.draft->>'coverLetter',
  'resume',case when r.id is not null then jsonb_build_object('id',r.id,'name',r.name,'version',r.version) end,
  'blocker',a.blocker,
  'requiresReview',x->>'kind' in ('review_application','review_outreach'),
  'reference',jsonb_build_object('id',x->>'sourceId','kind',case when x->>'kind'='review_outreach' then 'person' when x->>'kind' in ('verify_answer','missing_answer') then 'answer' when x->>'kind'='confirm_interview' then 'interview' else 'application' end,
   'label',case when x->>'kind'='review_outreach' then coalesce(nullif(x->>'recipient',''),x->>'company','Saved person') when x->>'kind'='confirm_interview' then coalesce(x->>'title','Interview round') else coalesce(nullif(x->>'company',''),nullif(x->>'title',''),'Saved application') end,
   'detail',case when x->>'kind' in ('review_outreach','confirm_interview') then x->>'company' else coalesce(x->>'role',x->>'title') end,'href',x->>'href'))
 from private.action_board_items_before_inline_cards(owner_id) x
 left join public.applications a on a.id::text=x->>'applicationId' and a.user_id=owner_id
 left join public.resumes r on r.id::text=a.draft->>'resumeId' and r.user_id=owner_id
$$;
revoke all on function private.action_board_items(uuid) from public,anon,authenticated;

alter function public.respond_action_board(jsonb) set schema private;
alter function private.respond_action_board(jsonb) rename to respond_action_board_before_inline_cards;
revoke all on function private.respond_action_board_before_inline_cards(jsonb) from public,anon,authenticated;
create function public.respond_action_board(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); item jsonb; prior private.action_response_events; response text:=payload->>'response'; key text:=payload->>'key'; input jsonb:=coalesce(payload->'input','{}'); a public.applications; t public.submission_attempts; m public.application_milestones; imported public.imported_jobs; tracker_version integer; next_questions jsonb; q jsonb; answer jsonb; n integer; result jsonb; policy text;
begin
 if owner_id is null then raise exception 'Human sign-in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['key','response','eventKey','policy','expectedVersion','input']<>'{}' or jsonb_typeof(input) is distinct from 'object' or input-array['answers','answer','note','confirmed','at','timeZone','resumeId']<>'{}' or octet_length(input::text)>60000 or coalesce(key,'')='' or length(key)>400 or response not in ('review','accept','reject','resume','save') or response is null or payload->>'eventKey' is null then raise exception 'Invalid human decision' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':action-board',0));
 select * into prior from private.action_response_events where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;
 if found then if prior.request<>payload then raise exception 'Decision retry changed' using errcode='40001';end if;return prior.result;end if;
 if response='resume' then result:=private.respond_action_board_before_inline_cards(payload-'input');update private.action_response_events set request=payload where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;return result;end if;
 select x into item from private.action_board_items(owner_id) x where x->>'key'=key;
 if item is null then raise exception 'Decision changed; reload' using errcode='40001';end if;
 if item->>'applicationId' is not null then select * into a from public.applications where id=(item->>'applicationId')::uuid and user_id=owner_id for update;
 elsif item->>'kind' in ('verify_answer','missing_answer') then perform 1 from public.answer_library where id=(item->>'sourceId')::uuid and user_id=owner_id for update;
 elsif item->>'kind'='imported_action' then
  -- Same lock ordering as the shared imported tracker writer.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':simplify-import',0));
  select * into imported from public.imported_jobs where id=(item->>'sourceId')::uuid and user_id=owner_id for update;
 end if;
 select x into item from private.action_board_items(owner_id) x where x->>'key'=key;
 if item is null then raise exception 'Decision changed; reload' using errcode='40001';end if;
 -- Unchanged exact-review operations retain the original validators and receipts.
 if (item->>'kind' in ('review_application','review_outreach','confirm_interview','verify_answer') and response<>'save' and input='{}') or response='review' then result:=private.respond_action_board_before_inline_cards(payload-'input');update private.action_response_events set request=payload where user_id=owner_id and event_key=(payload->>'eventKey')::uuid;return result;end if;
 if response='reject' and item->>'kind' in ('prepared_application','submit_application','resolve_blocker') then
  update public.applications set draft=jsonb_set(draft,'{questionsReviewed}','false'::jsonb),status='Draft' where id=a.id;
  insert into public.application_work_holds(user_id,application_id) values(owner_id,a.id) on conflict(application_id) do update set stopped_at=now(),resumed_at=null,version=public.application_work_holds.version+1;
  update private.backend_jobs bj set status='cancelled',version=version+1,finished_at=now(),lease_token=null,lease_expires_at=null,updated_at=now() where user_id=owner_id and kind='application_submit' and bj.input->>'applicationId'=a.id::text and status='queued';
  update public.action_inbox set resolved_at=now(),resolution='work_stopped' where user_id=owner_id and application_id=a.id and resolved_at is null and kind<>'check_submission';
 elsif item->>'kind' in ('prepared_application','resolve_blocker','review_application') and response in ('accept','save') then
  if response='accept' and item->>'kind'='review_application' then raise exception 'Save edited answers and review the new revision first' using errcode='42501';end if;
  if jsonb_typeof(input->'answers') is distinct from 'array' or jsonb_array_length(input->'answers')<>jsonb_array_length(coalesce(a.draft->'questions','[]')) then raise exception 'Supply the current employer answers' using errcode='22023';end if;
  next_questions:='[]'; n:=0;
  for q in select value from jsonb_array_elements(coalesce(a.draft->'questions','[]')) loop
   answer:=input->'answers'->n;
   if jsonb_typeof(answer) is distinct from 'string' or length(answer#>>'{}')>10000 or (response='accept' and (nullif(trim(answer#>>'{}'),'') is null or lower(trim(answer#>>'{}'))='ask me') and coalesce(q->>'required','true')<>'false' and coalesce(q->>'fieldType','')<>'hidden') then raise exception 'Complete the required form fields' using errcode='22023';end if;
   next_questions:=next_questions||jsonb_build_array(q||jsonb_build_object('answer',answer));n:=n+1;
  end loop;
  if response='accept' and input->'confirmed' is distinct from 'true'::jsonb then raise exception 'Confirm the displayed answers first' using errcode='22023';end if;
  if response='accept' and item->>'kind'='resolve_blocker' and not exists(select 1 from jsonb_array_elements(next_questions) visible_question(value) where coalesce(visible_question.value->>'fieldType','')<>'hidden') and length(trim(coalesce(input->>'note',''))) not between 1 and 500 then raise exception 'Describe how the blocker was resolved' using errcode='22023';end if;
  if input?'resumeId' and not exists(select 1 from public.resumes where user_id=owner_id and id::text=input->>'resumeId') then raise exception 'Owned resume required' using errcode='42501';end if;
  -- Saving changes creates a new revision. It never approves that new revision.
  update public.applications set draft=jsonb_set(jsonb_set(draft||case when input?'resumeId' then jsonb_build_object('resumeId',input->>'resumeId') else '{}'::jsonb end,'{questions}',next_questions),'{questionsReviewed}',to_jsonb(response='accept')),blocker=case when response='accept' then null else blocker end where id=a.id;
 elsif item->>'kind' in ('verify_answer','missing_answer') then
  if response='accept' then
   policy:=payload->>'policy';
   if policy is null or policy not in ('ask','auto') or jsonb_typeof(input->'answer') is distinct from 'string' or length(trim(coalesce(input->>'answer',''))) not between 1 and 10000 then raise exception 'Answer and explicit reuse permission required' using errcode='22023';end if;
   update public.answer_library set answer=input->>'answer',verified_at=now(),provenance='user',autofill_policy=policy,updated_at=now() where id=(item->>'sourceId')::uuid and user_id=owner_id;
  elsif response<>'reject' then raise exception 'Choose Accept or Reject' using errcode='22023';end if;
 elsif item->>'kind'='confirm_interview' and response='accept' then
  select * into m from public.application_milestones where id=(item->>'sourceId')::uuid and user_id=owner_id for update;
  if length(coalesce(input->>'at','')) not between 10 and 40 then raise exception 'Interview date and time required' using errcode='22023';end if;
  perform private.record_application_milestone_owned(owner_id,m.application_id,jsonb_build_object('eventKey','board:'||(payload->>'eventKey'),'kind',m.kind,'label',m.label,'phase',m.phase,'occurredAt',input->>'at','supersedesId',m.id,'practiceCategory',m.practice_category,'timeZone',coalesce(input->>'timeZone','UTC'),'source',jsonb_build_object('kind','user','timestampConfirmed',true,'note','Confirmed in Action Board')),'user');
 elsif item->>'kind'='imported_action' and response in ('accept','reject') then
  select version into tracker_version from private.tracker_import_versions where user_id=owner_id;
  perform private.update_imported_job_owned(owner_id,jsonb_build_object('id',imported.id,'expectedVersion',coalesce(tracker_version,0),'eventKey','board:'||(payload->>'eventKey'),'changes',jsonb_build_object('needsAction',false)));
 elsif item->>'kind' in ('check_submission','submit_application') and response in ('accept','reject') then
  if length(trim(coalesce(input->>'note',''))) not between 1 and 500 or input->'confirmed' is distinct from 'true'::jsonb then raise exception 'Check the employer portal and add a verification note first' using errcode='22023';end if;
  if response='accept' then perform private.set_application_stage(a.id,a.revision,'Submitted',input->>'note');
  else
   select * into t from public.submission_attempts where user_id=owner_id and application_id=a.id and state in ('started','uncertain') order by created_at desc,id desc limit 1;
   if t.id is null then raise exception 'No uncertain submission remains' using errcode='40001';end if;
   perform private.resolve_submission_attempt(a.id,a.revision,t.id,input->>'note');
  end if;
 else raise exception 'Use the action shown on the card' using errcode='22023';end if;
 if response<>'save' then
  insert into private.action_decision_receipts(user_id,decision_key,source_kind,source_id,response,responded_at) values(owner_id,key,item->>'kind',item->>'sourceId',response,now()) on conflict(user_id,decision_key) do update set response=excluded.response,responded_at=excluded.responded_at;
 end if;
 result:=jsonb_build_object('response',response,'key',key,'saved',true);
 insert into private.action_response_events values(owner_id,(payload->>'eventKey')::uuid,payload,result);
 return result;
end $$;
revoke all on function public.respond_action_board(jsonb) from public,anon;
grant execute on function public.respond_action_board(jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
