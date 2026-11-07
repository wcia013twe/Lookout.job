begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();did uuid:=gen_random_uuid();rid uuid:=gen_random_uuid();legacy uuid:=gen_random_uuid();a jsonb;p jsonb;r jsonb;page jsonb;profile text:='INTERVIEWER_ONLY: ask about a worker crash; follow up on idempotency; score reasoning.';k text:=repeat('a',64);f text:=repeat('b',64);ro text:=repeat('c',64);i integer;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'Mock',k,array['workspace:read','drafts:write'],now()+interval '1 hour'),
 (v,'Other',f,array['workspace:read','drafts:write'],now()+interval '1 hour'),
 (u,'Read only',ro,array['workspace:read'],now()+interval '1 hour');
 perform set_config('test.uid',u::text,true);
 a:=jsonb_build_object('id',sid,'expectedVersion',0,'title','Backend mock','purpose','Prepare for the systems round','kind','mock_interview','format','markdown','body','Call your agent when ready.','weekOf','2026-11-02','scheduledAt','2026-11-08T19:00:00-05:00','timeZone','America/New_York','durationMinutes',30,'sessionStatus','scheduled','sources','[]'::jsonb,'links','[]'::jsonb);
 p:=jsonb_build_object('artifact',a,'interviewerProfile',profile);
 r:=public.agent_dispatch(k,'mock.save',p);
 -- Match hosted service_role; the PGlite harness creates it without BYPASSRLS.
 execute 'alter role service_role bypassrls';
 execute 'set local role service_role';
 r:=public.agent_dispatch(k,'mock.read',jsonb_build_object('id',sid));
 execute 'reset role';
 if r->>'interviewerProfile'<>profile then raise exception 'Service dispatch lost profile';end if;
 r:=public.agent_dispatch(k,'mock.save',p);
 if public.agent_dispatch(k,'mock.save',p)<>r then raise exception 'Mock retry did not replay';end if;
 if public.agent_dispatch(k,'mock.read',jsonb_build_object('id',sid))->>'interviewerProfile'<>profile then raise exception 'Profile lost';end if;
 begin perform public.agent_dispatch(k,'mock.save',p||jsonb_build_object('interviewerProfile','changed'));raise exception 'Changed retry accepted';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(f,'mock.read',jsonb_build_object('id',sid));raise exception 'Foreign profile accepted';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(ro,'mock.save',p);raise exception 'Read-only write accepted';exception when insufficient_privilege then null;end;
 begin perform public.artifact_action('mock.read',jsonb_build_object('id',sid));raise exception 'Browser retrieved profile';exception when invalid_parameter_value then null;end;
 begin perform public.artifact_action('artifacts.save',a);raise exception 'Browser mock bypass';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','private.mock_interview_profiles','select') or has_function_privilege('authenticated','private.mock_interview_owned(uuid,text,jsonb)','execute') then raise exception 'Profile grants leaked';end if;
 r:=public.artifact_action('artifacts.read',jsonb_build_object('id',sid));
 if position('INTERVIEWER_ONLY' in r::text)>0 then raise exception 'Profile in browser read';end if;
 r:=public.agent_dispatch(k,'artifacts.list','{"shelf":"all","weekOf":"2026-11-02"}');
 if jsonb_array_length(r->'items')<>1 or position('INTERVIEWER_ONLY' in r::text)>0 then raise exception 'Weekly summary/profile mismatch';end if;
 -- Exact local week is Sunday even though UTC is already Monday.
 begin perform public.agent_dispatch(k,'mock.save',jsonb_build_object('artifact',a||'{"expectedVersion":1,"weekOf":"2026-11-09"}','interviewerProfile',profile));raise exception 'Wrong local week accepted';exception when invalid_parameter_value then null;end;
 a:=a||'{"expectedVersion":1,"sessionStatus":"in_progress"}';
 perform public.agent_dispatch(k,'mock.save',jsonb_build_object('artifact',a,'interviewerProfile',profile));
 if public.agent_dispatch(k,'mock.read',jsonb_build_object('id',sid))->'artifact'->'content'->>'sessionStatus'<>'in_progress' then raise exception 'Cannot resume';end if;
 begin perform public.agent_dispatch(k,'mock.save',p);raise exception 'Stale overwrite accepted';exception when serialization_failure then null;end;
 begin perform public.agent_dispatch(k,'mock.save',jsonb_build_object('artifact',a||'{"expectedVersion":2,"sessionStatus":"completed"}','interviewerProfile',profile));raise exception 'Completed without debrief';exception when invalid_parameter_value then null;end;
 p:=jsonb_build_object('id',did,'expectedVersion',0,'title','Actual practice feedback','purpose','Next round gap','kind','interview_debrief','format','markdown','body','User answered retries; partial failure needs another exercise.','sources','[]'::jsonb,'links','[]'::jsonb);
 perform public.artifact_action('artifacts.save',p);
 a:=a||jsonb_build_object('expectedVersion',2,'sessionStatus','completed','debriefId',did);
 perform public.agent_dispatch(k,'mock.save',jsonb_build_object('artifact',a,'interviewerProfile',profile));
 begin perform public.agent_dispatch(k,'mock.save',jsonb_build_object('artifact',a||'{"expectedVersion":3,"sessionStatus":"scheduled"}','interviewerProfile',profile));raise exception 'Terminal session restarted';exception when invalid_parameter_value then null;end;
 -- Resource links use the exact same browser and agent writer.
 p:=p||jsonb_build_object('id',rid,'kind','resource','resourceUrl','https://example.com/course','weekOf','2026-11-02');
 r:=public.artifact_action('artifacts.save',p);
 if public.agent_dispatch(k,'artifacts.save',p)<>r then raise exception 'Resource writer parity';end if;
 begin perform public.artifact_action('artifacts.save',p||jsonb_build_object('id',gen_random_uuid(),'resourceUrl','javascript:alert(1)'));raise exception 'Unsafe URL';exception when invalid_parameter_value then null;end;
 perform public.artifact_action('artifacts.save',(p-array['resourceUrl','weekOf'])||jsonb_build_object('id',legacy,'kind','story_bank'));
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"all","weekOf":"2026-11-09"}')->'items')<>0 then raise exception 'Undated/old material moved weeks';end if;
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"all"}')->'items')<>4 then raise exception 'Library lost undated material';end if;
 -- Weekly filter must run before the pagination limit.
 for i in 1..27 loop perform public.artifact_action('artifacts.save',p||jsonb_build_object('id',gen_random_uuid(),'title','Resource '||i));end loop;
 page:=public.artifact_action('artifacts.list','{"shelf":"all","weekOf":"2026-11-02"}');
 if jsonb_array_length(page->'items')<>25 or page->>'nextOffset'<>'25' then raise exception 'Weekly pagination';end if;
 if jsonb_array_length(public.artifact_action('artifacts.list','{"shelf":"all","weekOf":"2026-11-02","offset":25}')->'items')<>4 then raise exception 'Weekly second page';end if;
 -- Archive/revision endpoints and collections remain safe metadata-only paths.
 perform public.artifact_action('artifacts.archive',jsonb_build_object('id',sid,'expectedVersion',3,'archived',true));
 r:=public.artifact_action('artifacts.read',jsonb_build_object('id',sid,'version',1));
 if position('INTERVIEWER_ONLY' in r::text)>0 then raise exception 'Historical profile leak';end if;
 delete from public.career_artifacts where id=sid;
 if exists(select 1 from private.mock_interview_profiles where artifact_id=sid) then raise exception 'Orphaned mock profile';end if;
end $$;
rollback;
