begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); r jsonb; payload jsonb; result jsonb; bid uuid; compact_bid uuid; bad jsonb; compact jsonb; assessment jsonb; compact_payload jsonb;
begin
 insert into auth.users(id) values(u),(other_u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Research agent',h,array['workspace:read','batches:write'],now()+interval '1 hour');
 insert into public.jobs(id,canonical_url,employer) values('assessment-job','https://example.com/assessment','{"company":"Example","title":"Systems","sourceFreshness":"Older than 72 hours"}');
 r:='{"priority":"Apply Now","materialGap":"Production experience needs verification","sourceFreshness":"Observed today","matchAssessment":{"percent":73,"evidence":"Profile project matches the official requirements","assessedAt":"2026-10-23T19:00:00Z","factors":[{"label":"Systems","value":73,"rating":"Good","reason":"Profile project"},{"label":"Team","value":null,"rating":"Unknown","reason":"Not disclosed"}]}}';
 payload:=jsonb_build_object('eventKey','dynamic-assessment','label','Research','jobs',jsonb_build_array(jsonb_build_object('jobId','assessment-job','recommendation',r)));
 result:=public.agent_dispatch(h,'batches.publish',payload);
 select batch_id into bid from public.batch_items where user_id=u and job_id='assessment-job';
 if bid is null or not exists(select 1 from public.batch_items where batch_id=bid and recommendation=r) then raise exception 'MCP assessment was not preserved';end if;
 -- Exact retry keeps the original immutable evidence, even if new text is sent.
 perform public.agent_dispatch(h,'batches.publish',jsonb_set(payload,'{jobs,0,recommendation,materialGap}','"Changed"'));
 if not exists(select 1 from public.batch_items where batch_id=bid and recommendation=r) then raise exception 'Retry rewrote historical research';end if;
 foreach bad in array array[jsonb_set(r,'{matchAssessment,percent}','101'),jsonb_set(r,'{matchAssessment,evidence}','""'),jsonb_set(r,'{matchAssessment,assessedAt}','"yesterday"'),jsonb_set(r,'{matchAssessment,factors,0,value}','-1'),jsonb_set(r,'{priority}','"Recommended"'),jsonb_set(r,'{materialGap}','null')] loop
  begin
   insert into public.batch_items(user_id,batch_id,job_id,position,recommendation) values(u,bid,'assessment-job',99,bad);
   raise exception 'Malformed recommendation accepted';
  exception when invalid_parameter_value then null;end;
 end loop;
 -- The new card format persists inside the same private recommendation document.
 compact:='{"priority":"Strong Consider","matchAssessment":{"skillsExperience":{"score":81,"reasoning":"Systems project matches; production scale remains unverified."},"compensation":{"score":null,"reasoning":"Employer has not disclosed compensation."},"wellbeingCulture":{"score":62,"reasoning":"Team workload needs direct verification."},"locationWorkSetting":{"score":94,"reasoning":"Listed location matches the saved preference."},"assessedAt":"2026-10-26T17:00:00Z"}}';
 compact_payload:=jsonb_build_object('eventKey','compact-assessment','label','Compact research','jobs',jsonb_build_array(jsonb_build_object('jobId','assessment-job','recommendation',compact)));
 result:=public.agent_dispatch(h,'batches.publish',compact_payload);
 select batch_id into compact_bid from public.batch_items where user_id=u and job_id='assessment-job' and batch_id<>bid;
 if compact_bid is null or not exists(select 1 from public.batch_items where batch_id=compact_bid and recommendation=compact) then raise exception 'Compact assessment was not preserved';end if;
 perform public.agent_dispatch(h,'batches.publish',jsonb_set(compact_payload,'{jobs,0,recommendation,matchAssessment,skillsExperience,score}','12'));
 if not exists(select 1 from public.batch_items where batch_id=compact_bid and recommendation=compact) then raise exception 'Retry rewrote compact card';end if;
 assessment:=compact->'matchAssessment';
 -- A third immutable batch proves optional legacy summary metadata coexists with scores.
 perform public.agent_dispatch(h,'batches.publish',jsonb_set(jsonb_set(compact_payload,'{eventKey}','"compact-with-summary"'),'{jobs,0,recommendation,matchAssessment}',assessment||'{"percent":79,"evidence":"Agent assessment from the saved profile and employer posting."}'));
 foreach bad in array array[
  assessment-'compensation',assessment||'{"extra":"forbidden"}',assessment||'{"factors":[]}',
  jsonb_set(assessment,'{skillsExperience,score}','101'),jsonb_set(assessment,'{skillsExperience,score}','-1'),
  jsonb_set(assessment,'{skillsExperience,score}','"81"'),
  jsonb_set(assessment,'{skillsExperience,reasoning}',to_jsonb(repeat('x',241))),
  jsonb_set(assessment,'{skillsExperience,reasoning}','"  "'),
  jsonb_set(assessment,'{skillsExperience}',(assessment->'skillsExperience')-'score'),
  jsonb_set(assessment,'{skillsExperience}',(assessment->'skillsExperience')||'{"extra":true}'),
  assessment-'assessedAt',assessment||'{"assessedAt":"yesterday"}',
  assessment||'{"percent":101}',assessment||'{"evidence":""}',assessment||jsonb_build_object('evidence',repeat('x',1001))
 ] loop
  begin
   perform public.agent_dispatch(h,'batches.publish',jsonb_set(jsonb_set(compact_payload,'{eventKey}',to_jsonb('bad-compact-'||gen_random_uuid()::text)),'{jobs,0,recommendation,matchAssessment}',bad));
   raise exception 'Malformed compact assessment accepted';
  exception when invalid_parameter_value then null;end;
 end loop;
 if exists(select 1 from public.jobs where id='assessment-job' and employer ? 'matchAssessment') then raise exception 'Private scores leaked into employer data';end if;
 -- Existing browser read path is owner-scoped and receives the same private data.
 perform set_config('test.uid',u::text,true);set local role authenticated;
 if not exists(select 1 from public.batch_items where batch_id=bid and recommendation=r) then raise exception 'Owner cannot read assessment';end if;
 if not exists(select 1 from public.batch_items where batch_id=compact_bid and recommendation=compact) then raise exception 'Owner cannot read compact assessment';end if;
 perform set_config('test.uid',other_u::text,true);
 if exists(select 1 from public.batch_items where batch_id in (bid,compact_bid)) then raise exception 'Another owner read private research';end if;
 reset role;
end $$;
rollback;
