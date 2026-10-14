begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); c uuid; c2 uuid; h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); h2 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); j text:='onboard-'||gen_random_uuid(); b uuid; t jsonb; replay jsonb; s jsonb; req jsonb; seen_revision bigint;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Muse',h,array['workspace:read','preferences:write','batches:write','drafts:write'],now()+interval '1 day') returning id into c;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(v,'Other',h2,array['workspace:read','preferences:write','batches:write'],now()+interval '1 day') returning id into c2;
 if has_function_privilege('anon','public.onboarding_action(text,jsonb)','execute') or has_function_privilege('authenticated','private.onboarding_action(uuid,text,jsonb,uuid)','execute') then raise exception 'Privilege leak'; end if;
 perform set_config('test.uid',u::text,true);
 s:=public.onboarding_action('onboarding.get_state','{}');
 if s->>'step'<>'connection_pending' or s->'capabilities'->'push'<>'false' then raise exception 'Unsafe initial state'; end if;
 begin perform public.onboarding_action('onboarding.submit_step','{"expectedRevision":0,"eventKey":"fake-runtime","event":"runtime","data":{"browsing":true}}'); raise exception 'Human forged runtime'; exception when insufficient_privilege then null; end;
 s:=public.agent_dispatch(h,'onboarding.submit_step','{"expectedRevision":0,"eventKey":"runtime","event":"runtime","data":{"browsing":true}}');
 if s->>'step'<>'intent_pending' then raise exception 'Runtime not advanced'; end if;
 req:=jsonb_build_object('expectedRevision',1,'eventKey','intent','event','intent','data',jsonb_build_object('text','Backend internships in Bay Area'));
 s:=public.onboarding_action('onboarding.submit_step',req);
 replay:=public.onboarding_action('onboarding.submit_step',req);
 if s<>replay or s->>'step'<>'first_match_pending' then raise exception 'Replay changed state'; end if;
 begin perform public.onboarding_action('onboarding.submit_step',req||'{"eventKey":"stale"}'); raise exception 'Stale step accepted'; exception when serialization_failure then null; end;
 begin perform public.onboarding_action('onboarding.submit_step','{"expectedRevision":2,"eventKey":"skip","event":"policy","data":{"choice":"auto_apply_requested"}}'); raise exception 'Skipped first match'; exception when invalid_parameter_value then null; end;
 req:='{"expectedRevision":2,"eventKey":"scan","kind":"discover"}';
 t:=public.onboarding_action('tasks.create',req);
 if t<>public.onboarding_action('tasks.create',req) then raise exception 'Duplicated task'; end if;
 begin perform public.agent_dispatch(h2,'tasks.claim',jsonb_build_object('taskId',t->>'id')); raise exception 'Cross owner claim'; exception when no_data_found then null; end;
 t:=public.agent_dispatch(h,'tasks.claim',jsonb_build_object('taskId',t->>'id'));
 if t<>public.agent_dispatch(h,'tasks.claim',jsonb_build_object('taskId',t->>'id')) then raise exception 'Claim replay changed'; end if;
 begin perform public.agent_dispatch(h2,'tasks.report_result',jsonb_build_object('taskId',t->>'id','claimToken',t->>'claim_token','expectedRevision',1,'state','completed','result',jsonb_build_object('summary','Fake'))); raise exception 'Cross owner result'; exception when no_data_found then null; end;
 begin perform public.agent_dispatch(h,'tasks.report_result',jsonb_build_object('taskId',t->>'id','claimToken',t->>'claim_token','expectedRevision',1,'state','completed','result',jsonb_build_object('summary','Invented result'))); raise exception 'Missing batch accepted'; exception when invalid_parameter_value then null; end;
 insert into public.jobs(id,canonical_url,employer) values(j,'https://careers.example.com/'||j,'{"company":"Test","title":"Backend intern"}');
 insert into public.job_batches(user_id,label,source_event_id) values(u,'First match','first-match') returning id into b;
 insert into public.batch_items(user_id,batch_id,job_id,position) values(u,b,j,0);
 req:=jsonb_build_object('taskId',t->>'id','claimToken',t->>'claim_token','expectedRevision',1,'state','completed','result',jsonb_build_object('summary','Found one live employer role','batchId',b));
 t:=public.agent_dispatch(h,'tasks.report_result',req);
 if t<>public.agent_dispatch(h,'tasks.report_result',req) then raise exception 'Report replay changed'; end if;
 req:=jsonb_build_object('expectedRevision',2,'eventKey','first','event','first_match','data',jsonb_build_object('jobId',j,'sourceUrl','https://careers.example.com/'||j,'available',true,'checkedAt',now(),'evidence','Employer posting is open and accepts applications','fit','Backend internship matches explicit intent'));
 begin perform public.agent_dispatch(h,'onboarding.submit_step',jsonb_set(req,'{data,checkedAt}',to_jsonb(now()-interval '2 days'))); raise exception 'Stale evidence accepted'; exception when invalid_parameter_value then null; end;
 s:=public.agent_dispatch(h,'onboarding.submit_step',req);
 if s->>'step'<>'action_policy_pending' or s->'data'->'match'->'fitPreliminary'<>'true' then raise exception 'Resume was required before first value'; end if;
 s:=public.onboarding_action('onboarding.submit_step','{"expectedRevision":3,"eventKey":"policy","event":"policy","data":{"choice":"recommend"}}');
 if s->>'step'<>'execution_ready' then raise exception 'Recommend required resume'; end if;
 perform public.save_preferences_preserving_quiet('{}','[]',null,'{}');
 if (select search->'onboarding'->>'policy' from public.preferences where user_id=u) is distinct from 'recommend' then raise exception 'Browser sync erased onboarding preferences'; end if;
 s:=public.onboarding_action('onboarding.submit_step',jsonb_build_object('expectedRevision',4,'eventKey','result','event','execution_result','data',jsonb_build_object('taskId',t->>'id')));
 s:=public.onboarding_action('onboarding.submit_step','{"expectedRevision":5,"eventKey":"delivery","event":"delivery","data":{"mode":"skip"}}');
 if s->>'step'<>'ready' or s->'data'->'delivery'->'active'<>'false' or s->'data'->'social'->'sharingEnabled'<>'false' or s->'data'->'autoApplyEnabled'<>'false' then raise exception 'Unsafe ready state'; end if;
 perform set_config('test.uid',v::text,true);
 s:=public.onboarding_action('onboarding.get_state','{}');
 if s->>'step'<>'connection_pending' or jsonb_array_length(s->'tasks')<>0 or s->'data' ? 'intent' then raise exception 'Cross owner read'; end if;
 -- Auto-apply request is conditional setup, never an approval, verification, or permission toggle.
 perform public.agent_dispatch(h2,'onboarding.submit_step','{"expectedRevision":0,"eventKey":"runtime","event":"runtime","data":{"browsing":true}}');
 perform public.agent_dispatch(h2,'onboarding.submit_step','{"expectedRevision":1,"eventKey":"intent","event":"intent","data":{"text":"Infrastructure roles"}}');
 insert into public.job_batches(user_id,label,source_event_id) values(v,'Other first match','other-first') returning id into b;
 insert into public.batch_items(user_id,batch_id,job_id,position) values(v,b,j,0);
 perform public.agent_dispatch(h2,'onboarding.submit_step',req||'{"eventKey":"first"}');
 s:=public.onboarding_action('onboarding.submit_step','{"expectedRevision":3,"eventKey":"auto","event":"policy","data":{"choice":"auto_apply_requested"}}');
 if s->>'step'<>'profile_verification_pending' or s->'data'->'autoApplyEnabled'<>'false' then raise exception 'Assent enabled auto apply'; end if;
 begin perform public.onboarding_action('onboarding.submit_step','{"expectedRevision":4,"eventKey":"profile","event":"profile_checked","data":{}}'); raise exception 'Missing verified facts accepted'; exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.approvals where user_id in(u,v)) or exists(select 1 from public.submission_attempts where user_id in(u,v)) then raise exception 'Onboarding created submission authority'; end if;
 update private.agent_connections set revoked_at=now() where id=c;
 begin perform public.agent_dispatch(h,'tasks.read','{}'); raise exception 'Revoked agent read'; exception when invalid_authorization_specification then null; end;
end $$;
set local role authenticated;
set local test.uid='11111111-1111-1111-1111-111111111111';
select public.onboarding_action('onboarding.get_state','{}');
do $$ begin
 begin perform 1 from private.onboarding_sessions; raise exception 'Authenticated role bypassed private state'; exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Recovery and concurrent-worker protections use current server leases/revisions.
do $$
declare u uuid:=gen_random_uuid(); c uuid; h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); reader text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); t jsonb; s jsonb; i integer;
begin
 insert into auth.users values(u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Worker',h,array['workspace:read','preferences:write','batches:write'],now()+interval '1 day') returning id into c;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Reader',reader,array['workspace:read'],now()+interval '1 day');
 perform set_config('test.uid',u::text,true);
 begin perform public.agent_dispatch(reader,'onboarding.submit_step','{"expectedRevision":0,"eventKey":"scope","event":"runtime","data":{"browsing":true}}'); raise exception 'Read key advanced onboarding'; exception when insufficient_privilege then null; end;
 perform public.agent_dispatch(h,'onboarding.submit_step','{"expectedRevision":0,"eventKey":"runtime","event":"runtime","data":{"browsing":true}}');
 perform public.agent_dispatch(h,'onboarding.submit_step','{"expectedRevision":1,"eventKey":"intent","event":"intent","data":{"text":"Backend jobs"}}');
 t:=public.onboarding_action('tasks.create','{"expectedRevision":2,"eventKey":"scan","kind":"discover"}');
 begin perform public.onboarding_action('tasks.create','{"expectedRevision":2,"eventKey":"duplicate-worker","kind":"discover"}'); raise exception 'Concurrent pending task accepted'; exception when serialization_failure then null; end;
 for i in 1..3 loop
  t:=public.agent_dispatch(h,'tasks.claim',jsonb_build_object('taskId',t->>'id'));
  update private.agent_tasks set lease_until=now()-interval '1 minute' where id=(t->>'id')::uuid;
  perform public.agent_dispatch(h,'tasks.read','{}');
 end loop;
 select to_jsonb(x) into t from private.agent_tasks x where id=(t->>'id')::uuid;
 if t->>'state'<>'uncertain' or (t->>'attempts')::int<>3 then raise exception 'Unbounded retry or expired claim did not become uncertain'; end if;
 begin perform public.agent_dispatch(h,'tasks.claim',jsonb_build_object('taskId',t->>'id')); raise exception 'Uncertain work reclaimed'; exception when serialization_failure then null; end;
 begin perform public.agent_dispatch(h,'onboarding.submit_step',jsonb_build_object('expectedRevision',2,'eventKey','fake-resolve','event','resolve_task','data',jsonb_build_object('taskId',t->>'id','expectedTaskRevision',t->'revision'))); raise exception 'Agent manufactured human recovery'; exception when insufficient_privilege then null; end;
 s:=public.onboarding_action('onboarding.submit_step',jsonb_build_object('expectedRevision',2,'eventKey','human-resolve','event','resolve_task','data',jsonb_build_object('taskId',t->>'id','expectedTaskRevision',t->'revision')));
 if s->>'revision'<>'3' then raise exception 'Recovery was not revisioned'; end if;
 t:=public.onboarding_action('tasks.create','{"expectedRevision":3,"eventKey":"retry-after-review","kind":"discover"}');
 if t->>'state'<>'queued' then raise exception 'Reviewed failure could not retry'; end if;
 -- Policy downgrade is a real step, never an implicit auto-apply activation.
 update private.agent_tasks set state='failed' where user_id=u;
 update private.onboarding_sessions set step='execution_ready',data=data||'{"policy":"auto_apply_requested"}' where user_id=u;
 s:=public.onboarding_action('onboarding.submit_step','{"expectedRevision":3,"eventKey":"downgrade","event":"policy","data":{"choice":"recommend"}}');
 if s->>'step'<>'execution_ready' or s->'data'->>'policy'<>'recommend' or s->'data'->'autoApplyEnabled'<>'false' then raise exception 'Blocked policy could not downgrade safely'; end if;
end $$;
rollback;

