begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); r jsonb; payload jsonb; result jsonb; bid uuid; bad jsonb;
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
 -- Existing browser read path is owner-scoped and receives the same private data.
 perform set_config('test.uid',u::text,true);set local role authenticated;
 if not exists(select 1 from public.batch_items where batch_id=bid and recommendation=r) then raise exception 'Owner cannot read assessment';end if;
 perform set_config('test.uid',other_u::text,true);
 if exists(select 1 from public.batch_items where batch_id=bid) then raise exception 'Another owner read private research';end if;
 reset role;
end $$;
rollback;
