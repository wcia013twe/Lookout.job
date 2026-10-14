begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); p jsonb; r jsonb;
begin
 insert into auth.users(id) values(u),(other_u);
 insert into public.preferences(user_id,search) values(u,'{"autoSubmitApproved":false,"defaultResumeId":"keep"}');
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Profile test',h,array['workspace:read'],now()+interval '1 hour');
 p:='{"id":"general","name":"General","active":true,"filters":{"Work arrangement":"Remote required"},"priorities":{"Pay":"Important"},"instructions":"Anything suitable"}';
 begin
  perform public.agent_dispatch(h,'preferences.profile.save',jsonb_build_object('expectedVersion',0,'profile',p));
  raise exception 'Missing write scope accepted';
 exception when insufficient_privilege then null; end;
 update private.agent_connections set scopes=array['workspace:read','preferences:write'] where token_hash=h;
 r:=public.agent_dispatch(h,'preferences.profile.save',jsonb_build_object('expectedVersion',0,'profile',p));
 if r->>'version'<>'1' then raise exception 'Wrong version'; end if;
 begin
  perform public.agent_dispatch(h,'preferences.profile.save',jsonb_build_object('expectedVersion',0,'profile',p));
  raise exception 'Stale update accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.agent_dispatch(h,'preferences.profile.save',jsonb_build_object('expectedVersion',1,'profile',p||'{"autoSubmitApproved":true}'));
  raise exception 'Policy injection accepted';
 exception when invalid_parameter_value then null; end;
 if exists(select 1 from public.preferences where user_id=other_u) then raise exception 'Foreign owner changed'; end if;
 if (select search->>'defaultResumeId' from public.preferences where user_id=u)<>'keep' then raise exception 'Unrelated settings changed'; end if;
 perform set_config('test.uid',u::text,true);
 execute 'set local role authenticated';
 r:=public.save_search_profile(1,p||'{"instructions":"Updated through UI"}');
 if r->>'version'<>'2' then raise exception 'UI does not share version checks'; end if;
 perform public.save_workspace_preferences('{"autoSubmitApproved":false,"profiles":[]}','[]',null,'{}');
 if (select search#>>'{profiles,0,instructions}' from public.preferences where user_id=u)<>'Updated through UI' then raise exception 'Autosync clobbered profile'; end if;
 execute 'reset role';
 update private.agent_connections set revoked_at=now() where token_hash=h;
 begin
  perform public.agent_dispatch(h,'preferences.profile.save',jsonb_build_object('expectedVersion',2,'profile',p));
  raise exception 'Revoked credential accepted';
 exception when invalid_authorization_specification then null; end;
end $$;
do $$
declare u uuid:=gen_random_uuid(); p jsonb; result public.preferences; h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); c jsonb;
begin
 insert into auth.users(id) values(u);
 perform set_config('test.uid',u::text,true);
 p:=private.save_search_profile_for_owner(u,0,'{"id":"sync","name":"General","active":true,"filters":{},"priorities":{},"instructions":"Keep me"}');
 execute 'set local role authenticated';
 result:=public.save_preferences_preserving_quiet('{"profiles":[],"autoSubmitApproved":false}','[]',null,'{}');
 if result.search#>>'{profiles,0,instructions}'<>'Keep me' then raise exception 'Generic sync overwrote scoped profiles'; end if;
 execute 'reset role';
 c:=public.manage_agent_connection(u,'connections.issue',jsonb_build_object('name','Permissions','tokenHash',h,'scopes',jsonb_build_array('workspace:read'),'expiresInDays',1));
 c:=public.manage_agent_connection(u,'connections.profile_setup',jsonb_build_object('id',c->>'id','enabled',true));
 if not c->'scopes' ? 'profile:write' then raise exception 'Profile setup interface lost'; end if;
end $$;
rollback;
