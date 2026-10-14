begin;
do $$
declare
 u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); app uuid; other_app uuid;
 j text:='muse-feature-'||gen_random_uuid()::text; decision uuid; result jsonb; snapshot jsonb;
 h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
begin
 insert into auth.users(id) values(u),(other_u);
 insert into public.jobs(id,canonical_url,employer) values(j,'https://example.com/muse-feature','{}');
 insert into public.applications(user_id,job_id,draft) values(u,j,'{"questions":[{"question":"Why?","answer":"Current draft"}]}') returning id into app;
 insert into public.applications(user_id,job_id,draft) values(other_u,j,'{}') returning id into other_app;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
 values(u,'Muse feature tests',h,array['workspace:read','drafts:write','activity:write'],now()+interval '1 hour');
 insert into public.selection_decisions(user_id,job_id,event_key,reason,preference,evidence,certainty,personal_version)
 values(u,j,'owner-selection','Location excluded','location','Employer requires relocation','exclusion',1) returning id into decision;
 insert into public.preparation_plans(user_id,application_id,plan) values(other_u,other_app,'{"tasks":[]}');

 perform set_config('test.uid',u::text,true);
 execute 'set local role authenticated';
 if (select count(*) from public.preparation_plans)<>0 then raise exception 'Foreign preparation visible'; end if;
 begin
  insert into public.preparation_plans(user_id,application_id,plan) values(other_u,other_app,'{}');
  raise exception 'Foreign preparation insert allowed';
 exception when insufficient_privilege then null; end;
 update public.preparation_plans set plan='{"foreign":true}' where application_id=other_app;
 if found then raise exception 'Foreign preparation update allowed'; end if;
 perform public.save_preparation_plan(app,0,'{"tasks":[{"done":false}]}');
 perform public.save_preparation_plan(app,1,'{"tasks":[{"done":true}]}');
 if (select version from public.preparation_plans where application_id=app)<>2 then raise exception 'Plan version did not advance'; end if;
 begin perform public.save_preparation_plan(app,1,'{}'); raise exception 'Stale plan overwrite allowed'; exception when serialization_failure then null; end;
 begin perform public.save_preparation_plan(other_app,1,'{}'); raise exception 'Foreign plan RPC allowed'; exception when no_data_found then null; end;
 begin update public.preparation_plans set user_id=other_u where application_id=app; raise exception 'Plan owner reassigned'; exception when insufficient_privilege then null; end;
 perform public.reconsider_selection(decision,'');
 begin perform public.reconsider_selection(decision,''); raise exception 'Stale reconsideration accepted'; exception when serialization_failure then null; end;
 begin update public.selection_decisions set reason='Forged reason' where id=decision; raise exception 'Selection reason mutable'; exception when insufficient_privilege then null; end;
 begin insert into public.selection_decisions(user_id,job_id,event_key,reason,preference,evidence,certainty,personal_version) values(u,j,'forged','Forged','x','Forged','uncertain',1); raise exception 'Browser selection forgery allowed'; exception when insufficient_privilege then null; end;
 perform set_config('test.uid',other_u::text,true);
 if (select count(*) from public.selection_decisions)<>0 then raise exception 'Foreign selection visible'; end if;
 begin perform public.reconsider_selection(decision,''); raise exception 'Foreign reconsideration allowed'; exception when no_data_found then null; end;
 execute 'reset role';

 result:=public.agent_dispatch(h,'preparation.read',jsonb_build_object('applicationId',app));
 if result->'preparation'->>'version'<>'2' then raise exception 'Agent plan read incorrect'; end if;
 result:=public.agent_dispatch(h,'preparation.save',jsonb_build_object('applicationId',app,'expectedVersion',2,'plan','{"tasks":[]}'::jsonb));
 if result->>'version'<>'3' then raise exception 'Agent plan save incorrect'; end if;
 begin perform public.agent_dispatch(h,'preparation.save',jsonb_build_object('applicationId',app,'expectedVersion',2,'plan','{}'::jsonb)); raise exception 'Agent stale overwrite allowed'; exception when serialization_failure then null; end;
 begin perform public.agent_dispatch(h,'preparation.read',jsonb_build_object('applicationId',other_app)); raise exception 'Agent foreign plan allowed'; exception when no_data_found then null; end;
 result:=public.agent_dispatch(h,'selection.record',jsonb_build_object('jobId',j,'eventKey','agent-selection','reason','Compensation excluded','preference','compensation','evidence','Posted range below preference','certainty','exclusion'));
 if result->>'reason'<>'Compensation excluded' then raise exception 'Agent selection not recorded'; end if;
 update private.agent_connections set scopes=array['workspace:read'] where token_hash=h;
 begin perform public.agent_dispatch(h,'preparation.save',jsonb_build_object('applicationId',app,'expectedVersion',3,'plan','{}'::jsonb)); raise exception 'Plan scope bypass'; exception when insufficient_privilege then null; end;
 begin perform public.agent_dispatch(h,'selection.record',jsonb_build_object('jobId',j)); raise exception 'Selection scope bypass'; exception when insufficient_privilege then null; end;
 begin perform public.agent_dispatch(h,'notifications.ack',jsonb_build_object('eventKey','x')); raise exception 'Notification scope bypass'; exception when insufficient_privilege then null; end;

 snapshot:=jsonb_build_object('application',jsonb_build_object('draft',jsonb_build_object('questions',jsonb_build_array(jsonb_build_object('question','Why?','answer','Historical answer'))),'secret','omit'),
   'job',jsonb_build_object('canonical_url','https://example.com/muse-feature'),'resume',jsonb_build_object('id','historical-resume'),
   'profile',jsonb_build_object('email','private@example.com'),'answers',jsonb_build_array('unrelated answer'),'preferences',jsonb_build_object('secret',true));
 insert into public.submission_attempts(user_id,application_id,attempt_key,revision,state,context_snapshot,authorization_snapshot)
 values(u,app,'record-test',0,'cancelled',snapshot,'{"secret":"omit"}');
 result:=public.agent_dispatch(h,'applications.record',jsonb_build_object('applicationId',app));
 if jsonb_array_length(result->'attempts')<>1 then raise exception 'Attempt record missing'; end if;
 if result->'attempts'->0 ? 'authorization_snapshot' or result->'attempts'->0->'context_snapshot' ?| array['profile','answers','preferences']
  or result->'attempts'->0->'context_snapshot'->'application' ? 'secret' then raise exception 'Record leaks unrelated snapshot data'; end if;
 if result->'attempts'->0->'context_snapshot'->'application'->'draft'->'questions'->0->>'answer'<>'Historical answer' then raise exception 'Record substituted mutable draft'; end if;
 update private.agent_connections set scopes=array['workspace:read','activity:write'] where token_hash=h;
 begin perform public.agent_dispatch(h,'notifications.ack',jsonb_build_object('eventKey','foreign-deadline','kind','digest','eventIds',jsonb_build_array('deadline:'||other_app||':1'))); raise exception 'Foreign deadline acknowledged'; exception when insufficient_privilege then null; end;
 begin perform public.agent_dispatch(h,'notifications.ack',jsonb_build_object('eventKey','foreign-decision','kind','immediate','eventIds',jsonb_build_array('decision:'||other_app||':0'))); raise exception 'Foreign decision acknowledged'; exception when insufficient_privilege then null; end;
 begin perform public.agent_dispatch(h,'notifications.ack',jsonb_build_object('eventKey','invented-deadline','kind','digest','eventIds',jsonb_build_array('deadline:'||app||':999'))); raise exception 'Invented deadline version acknowledged'; exception when insufficient_privilege then null; end;
 result:=public.agent_dispatch(h,'notifications.ack',jsonb_build_object('eventKey','owned-synthetic','kind','digest','eventIds',jsonb_build_array('deadline:'||app||':3','decision:'||app||':'||(select revision from public.applications where id=app))));
 if jsonb_array_length(result->'event_ids')<>2 then raise exception 'Owned synthetic events not acknowledged'; end if;
 begin perform public.agent_dispatch(h,'applications.record',jsonb_build_object('applicationId',other_app)); raise exception 'Foreign record allowed'; exception when no_data_found then null; end;
 update private.agent_connections set scopes=array['activity:write'] where token_hash=h;
 begin perform public.agent_dispatch(h,'applications.record',jsonb_build_object('applicationId',app)); raise exception 'Record read scope bypass'; exception when insufficient_privilege then null; end;
 update private.agent_connections set revoked_at=now() where token_hash=h;
 begin perform public.agent_dispatch(h,'selection.read','{}'); raise exception 'Revoked credential accepted'; exception when invalid_authorization_specification then null; end;
 if has_function_privilege('authenticated','public.agent_dispatch(text,text,jsonb)','execute') then raise exception 'Browser trusted dispatch allowed'; end if;
end $$;
rollback;
