begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();c uuid;h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);h2 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);s jsonb;r jsonb;req jsonb;rev bigint;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Test runtime',h,array['workspace:read','preferences:write'],now()+interval '1 day') returning id into c;
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(v,'Other runtime',h2,array['workspace:read','preferences:write'],now()+interval '1 day');
 insert into public.preferences(user_id,search) values(u,jsonb_build_object('schedule',jsonb_build_object('enabled',true,'timezone','America/New_York','configVersion',1,'routines',jsonb_build_array(jsonb_build_object('id','daily-scan','title','Daily scan','description','Find jobs on schedule','enabled',true,'mode','scheduled','time','09:00','sourceIds','[]'::jsonb,'connectionIds',jsonb_build_array(c))))));
 perform set_config('test.uid',u::text,true);
 s:=public.onboarding_action('onboarding.get_state','{}');rev:=(s->>'revision')::bigint;
 req:=jsonb_build_object('expectedRevision',rev,'eventKey','connection-check','event','connection_test','data','{}'::jsonb);
 begin perform public.onboarding_action('onboarding.submit_step',req);raise exception 'Human forged agent check-in';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(h,'onboarding.submit_step',jsonb_set(req,'{data}','{"browsing":true}'));raise exception 'Setup attested extra capabilities';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(h,'onboarding.submit_step',jsonb_set(req,'{expectedRevision}','99'));raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
 s:=public.agent_dispatch(h,'onboarding.submit_step',req);
 if s->>'step'<>'connection_pending' or s->'data' ? 'runtime' or s->'data' ? 'intent' or s->'data' ? 'websiteCompletedAt' then raise exception 'Setup advanced work or fabricated authority';end if;
 if s->'data'->'connectionTest'->>'connectionId'<>c::text or s->'automationSetup'->'schedule'->'routines'->0->>'id'<>'daily-scan' then raise exception 'Connection or automation setup missing';end if;
 if exists(select 1 from private.agent_tasks where user_id=u) then raise exception 'Setup created work';end if;
 r:=public.agent_dispatch(h,'onboarding.submit_step',req);if r is distinct from s then raise exception 'Replay changed';end if;
 r:=public.onboarding_action('onboarding.get_state','{}');if r->'data'->'connectionTest' is distinct from s->'data'->'connectionTest' then raise exception 'Website cannot read check-in';end if;
 r:=public.agent_dispatch(h2,'onboarding.get_state','{}');if r->'data' ? 'connectionTest' then raise exception 'Other owner inherited check-in';end if;
 r:=public.agent_dispatch(h2,'onboarding.submit_step',req);if r->'automationSetup'->'schedule' <> 'null'::jsonb then raise exception 'Other owner received schedule';end if;
 update private.agent_connections set revoked_at=now() where id=c;
 begin perform public.agent_dispatch(h,'onboarding.submit_step',req);raise exception 'Revoked token replayed setup';exception when invalid_authorization_specification then null;end;
 if has_function_privilege('authenticated','private.connection_test_onboarding_previous(uuid,text,jsonb,uuid)','execute') then raise exception 'Private helper exposed';end if;
end $$;
rollback;
