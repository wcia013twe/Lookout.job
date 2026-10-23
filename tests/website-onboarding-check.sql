begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);s jsonb;r jsonb;req jsonb;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Muse',h,array['workspace:read','preferences:write'],now()+interval '1 day');
 perform set_config('test.uid',u::text,true);
 s:=public.onboarding_action('onboarding.get_state','{}');
 if s->'data' ? 'websiteCompletedAt' then raise exception 'New user already complete';end if;
 req:='{"expectedRevision":0,"eventKey":"website-finish","event":"website_complete","data":{}}';
 begin perform public.agent_dispatch(h,'onboarding.submit_step',req);raise exception 'Agent forged website completion';exception when insufficient_privilege then null;end;
 begin perform public.onboarding_action('onboarding.submit_step',jsonb_set(req,'{data}','{"websiteCompletedAt":"fake"}'));raise exception 'Client supplied timestamp';exception when invalid_parameter_value then null;end;
 begin perform public.onboarding_action('onboarding.submit_step',jsonb_set(req,'{expectedRevision}','9'));raise exception 'Stale revision accepted';exception when serialization_failure then null;end;
 s:=public.onboarding_action('onboarding.submit_step',req);
 if s->'data'->>'websiteCompletedAt' is null or s->>'step'<>'connection_pending' or s->'data' ? 'runtime' then raise exception 'Website completion confused with agent readiness';end if;
 r:=public.onboarding_action('onboarding.submit_step',req);
 if r is distinct from s then raise exception 'Replay changed';end if;
 r:=public.agent_dispatch(h,'onboarding.get_state','{}');
 if r->'data'->>'websiteCompletedAt' is distinct from s->'data'->>'websiteCompletedAt' then raise exception 'MCP read parity failed';end if;
 begin perform public.onboarding_action('onboarding.submit_step',jsonb_set(req,'{expectedRevision}','1'));raise exception 'Event key reused with new body';exception when invalid_parameter_value then null;end;
 perform set_config('test.uid',v::text,true);
 r:=public.onboarding_action('onboarding.get_state','{}');
 if r->'data' ? 'websiteCompletedAt' then raise exception 'Other account inherited completion';end if;
 if has_function_privilege('anon','public.onboarding_action(text,jsonb)','execute') or has_function_privilege('authenticated','private.website_onboarding_previous(uuid,text,jsonb,uuid)','execute') then raise exception 'Completion privilege leak';end if;
end $$;
rollback;
