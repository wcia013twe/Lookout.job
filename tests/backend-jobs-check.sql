begin;
do $$
#variable_conflict use_variable
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();c uuid;other uuid;h text:=repeat('8',64);h2 text:=repeat('9',64);j jsonb;again jsonb;s jsonb;claim jsonb;finish jsonb;run jsonb;payload jsonb;id uuid;reset_id uuid;preview jsonb;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Backend test',h,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day') returning agent_connections.id into c;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(v,'Other owner',h2,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day') returning agent_connections.id into other;
 insert into public.search_documents(user_id,kind,id,version,content,projection) values
 (u,'profile','test-profile',1,'{}','{"active":true}'),(v,'profile','test-profile',1,'{}','{"active":true}'),
 (u,'portals','shared',1,'{}','{"tracked_companies":[{"id":"test","name":"Fictional","enabled":true}],"search_queries":[]}');
 payload:='{"kind":"search_ats","input":{"profileId":"test-profile"},"eventKey":"queue-one"}';
 j:=public.backend_job_dispatch(h,'backend.jobs.submit',payload);id:=(j->>'id')::uuid;
 if j->>'status'<>'queued' or j->>'version'<>'1' or j ?| array['lease_token','lease_expires_at','credentialHash','token_hash'] then raise exception 'Invalid public job shape';end if;
 again:=public.backend_job_dispatch(h,'backend.jobs.submit',payload);if again<>j then raise exception 'Submit replay changed';end if;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"input":{"profileId":"missing"}}');raise exception 'Changed replay accepted';exception when invalid_parameter_value then null;end;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||jsonb_build_object('connectionId',c));raise exception 'Agent set connection';exception when invalid_parameter_value then null;end;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"bad-kind","kind":"apply"}');raise exception 'Unbounded kind accepted';exception when invalid_parameter_value then null;end;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"bad-input","input":{"profileId":"test-profile","sql":"select 1"}}');raise exception 'Unbounded input accepted';exception when invalid_parameter_value then null;end;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"   "}');raise exception 'Blank retry key accepted';exception when invalid_parameter_value then null;end;
 if public.backend_job_dispatch(h2,'backend.jobs.read',jsonb_build_object('jobId',id))->'jobs'<>'[]' then raise exception 'Cross-owner job read';end if;
 begin perform public.backend_job_dispatch(h2,'backend.jobs.cancel',jsonb_build_object('jobId',id,'expectedVersion',1));raise exception 'Cross-owner cancel';exception when no_data_found then null;end;
 update private.agent_connections set scopes=array['workspace:read'] where agent_connections.id=c;
 begin perform public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"scope-denied"}');raise exception 'Read-only scope executed';exception when insufficient_privilege then null;end;
 update private.agent_connections set scopes=array['workspace:read','preferences:write','drafts:write'] where agent_connections.id=c;
 perform set_config('test.uid',u::text,true);
 begin perform public.backend_job_action('backend.jobs.submit',payload||'{"eventKey":"human-no-connection"}');raise exception 'Browser executed without binding';exception when insufficient_privilege then null;end;
 begin perform public.backend_job_action('backend.jobs.submit',payload||jsonb_build_object('eventKey','human-wrong-connection','connectionId',other));raise exception 'Browser bound foreign agent';exception when insufficient_privilege then null;end;
 again:=public.backend_job_action('backend.jobs.read',jsonb_build_object('jobId',id));if again->'jobs'->0<>j then raise exception 'Browser/agent read parity';end if;
 -- Claim, fenced dispatch, pinned search run and terminal completion.
 claim:=public.backend_worker('claim','{}');if claim->'job'->>'id'<>id::text or claim->'job'->>'attempts'<>'1' then raise exception 'Claim failed';end if;
 finish:=jsonb_build_object('jobId',id,'leaseToken',claim->>'leaseToken','expectedVersion',claim->'job'->'version');
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','wrong','eventKey','job:'||id||':start')));raise exception 'Foreign profile dispatched';exception when insufficient_privilege then null;end;
 run:=public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','test-profile','eventKey','job:'||id||':start')));
 again:=public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','test-profile','eventKey','job:'||id||':start')));if again<>run then raise exception 'Start replay changed';end if;
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.read','payload',jsonb_build_object('runId',gen_random_uuid())));raise exception 'Unrelated run dispatched';exception when insufficient_privilege then null;end;
 -- Resume identity reads are bounded and pinned to this job's own run.
 again:=public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.discoveries.read','payload',jsonb_build_object('runId',run->>'id','offset',0,'limit',100)));
 if again<>'{"listings":[],"nextOffset":null}'::jsonb then raise exception 'Unexpected resume identity projection';end if;
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.discoveries.read','payload',jsonb_build_object('runId',gen_random_uuid(),'offset',0,'limit',100)));raise exception 'Unrelated resume identities read';exception when insufficient_privilege then null;end;
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.discoveries.read','payload',jsonb_build_object('runId',run->>'id','offset',0,'limit',101)));raise exception 'Unbounded resume identities read';exception when invalid_parameter_value then null;end;
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.discoveries.read','payload',jsonb_build_object('runId',run->>'id','offset',0,'limit',100,'decision','eligible')));raise exception 'Arbitrary resume filter accepted';exception when invalid_parameter_value then null;end;

 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','profile.update','payload','{}'::jsonb));raise exception 'Arbitrary dispatcher exposed';exception when invalid_parameter_value then null;end;
 update private.agent_connections set revoked_at=now() where agent_connections.id=c;
 begin perform public.backend_worker('finish',finish||'{"status":"completed","result":{}}');raise exception 'Revoked finish accepted';exception when insufficient_privilege then null;end;
 begin perform public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.context','payload','{"profileId":"test-profile"}'::jsonb));raise exception 'Revoked dispatch accepted';exception when insufficient_privilege then null;end;
 -- Human cancellation remains possible when the execution credential is revoked.
 j:=public.backend_job_action('backend.jobs.cancel',jsonb_build_object('jobId',id,'expectedVersion',claim->'job'->'version'));
 if (select state from public.search_runs where search_runs.id=(run->>'id')::uuid)<>'cancelled' then raise exception 'Cancelled backend retained active run';end if;
 begin perform public.backend_worker('finish',finish||'{"status":"completed","result":{}}');raise exception 'Cancelled lease completed';exception when serialization_failure then null;end;
 update private.agent_connections set revoked_at=null where agent_connections.id=c;
 -- Expired leases are reclaimed at most three times and old workers are fenced.
 j:=public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"retry-job"}');id:=(j->>'id')::uuid;
 claim:=public.backend_worker('claim','{}');finish:=jsonb_build_object('jobId',id,'leaseToken',claim->>'leaseToken','expectedVersion',claim->'job'->'version');
 run:=public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','test-profile','eventKey','job:'||id||':start')));
 update private.backend_jobs set lease_expires_at=now()-interval '1 second' where backend_jobs.id=id;
 begin perform public.backend_worker('finish',finish||'{"status":"completed","result":{}}');raise exception 'Expired lease completed';exception when serialization_failure then null;end;
 claim:=public.backend_worker('claim','{}');if claim->'job'->>'attempts'<>'2' then raise exception 'Lease not reclaimed';end if;
 begin perform public.backend_worker('finish',finish||'{"status":"completed","result":{}}');raise exception 'Old lease completed';exception when serialization_failure then null;end;
 update private.backend_jobs set lease_expires_at=now()-interval '1 second' where backend_jobs.id=id;
 claim:=public.backend_worker('claim','{}');if claim->'job'->>'attempts'<>'3' then raise exception 'Third claim missing';end if;
 finish:=jsonb_build_object('jobId',id,'leaseToken',claim->>'leaseToken','expectedVersion',claim->'job'->'version');
 j:=public.backend_worker('finish',finish||'{"status":"partial","result":{"summary":"Fictional test result"}}');
 if (select state from public.search_runs where search_runs.id=(run->>'id')::uuid)<>'partial' then raise exception 'Partial finish retained active run';end if;
 if j->>'status'<>'partial' or j ? 'lease_token' then raise exception 'Finish failed';end if;
 j:=public.backend_job_dispatch(h,'backend.jobs.submit',payload||'{"eventKey":"exhausted-job"}');id:=(j->>'id')::uuid;
 claim:=public.backend_worker('claim','{}');finish:=jsonb_build_object('jobId',id,'leaseToken',claim->>'leaseToken','expectedVersion',claim->'job'->'version');
 run:=public.backend_worker('dispatch',finish||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','test-profile','eventKey','job:'||id||':start')));
 update private.backend_jobs set status='running',attempts=3,lease_token=gen_random_uuid(),lease_expires_at=now()-interval '1 second' where backend_jobs.id=id;
 if public.backend_worker('claim','{}') is not null then raise exception 'Fourth claim allowed';end if;
 if (select state from public.search_runs where search_runs.id=(run->>'id')::uuid)<>'partial' then raise exception 'Retry exhaustion retained active run';end if;
 if (select status from private.backend_jobs where backend_jobs.id=id)<>'failed' then raise exception 'Exhausted job unresolved';end if;
 -- Schedule tick is atomic, replay-safe, bounded, and disables revoked executors.
 -- Removed scheduler operations reject even through direct SQL, without affecting jobs.
 begin perform public.backend_job_dispatch(h,'backend.schedules.save','{}');raise exception 'Retired scheduler write accepted';exception when invalid_parameter_value then null;end;
 begin perform public.backend_job_dispatch(h,'backend.schedules.read','{}');raise exception 'Retired scheduler read accepted';exception when invalid_parameter_value then null;end;
 begin perform public.backend_worker('enqueue_due','{}');raise exception 'Retired timer accepted';exception when invalid_parameter_value then null;end;
 if to_regclass('private.backend_schedules') is not null then raise exception 'Scheduler table remains';end if;
 perform public.backend_job_dispatch(h,'backend.jobs.submit','{"kind":"search_ats","input":{"profileId":"test-profile"},"eventKey":"revoked-job"}');
 update private.agent_connections set revoked_at=now() where agent_connections.id=c;
 if public.backend_worker('claim','{}') is not null then raise exception 'Revoked queued job claimed';end if;
 if has_function_privilege('authenticated','public.backend_worker(text,jsonb)','execute') or has_function_privilege('anon','public.backend_job_dispatch(text,text,jsonb)','execute') or has_function_privilege('authenticated','private.backend_action(uuid,uuid,text,jsonb)','execute') then raise exception 'Private execution boundary exposed';end if;
 -- Existing workspace reset must remove queued work and history while keeping Auth.
 preview:=public.workspace_reset_service(u,'preview');reset_id:=gen_random_uuid();
 if not (preview->'counts' ?& array['private.backend_jobs','private.backend_requests']) then raise exception 'Reset omits execution records';end if;
 perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',preview->'personalVersion'));
 begin update private.backend_jobs set result='{}' where user_id=u;raise exception 'Reset allowed queue write';exception when object_not_in_prerequisite_state then null;end;
 perform public.workspace_reset_service(u,'finish',jsonb_build_object('resetId',reset_id));
 if exists(select 1 from private.backend_jobs where user_id=u) or exists(select 1 from private.backend_requests where user_id=u) or not exists(select 1 from auth.users where auth.users.id=u) then raise exception 'Reset retained execution state or removed Auth';end if;
 if exists(select 1 from private.agent_tasks where user_id=u) then raise exception 'Backend queue rewrote agent tasks';end if;
end $$;
rollback;
