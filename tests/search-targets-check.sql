begin;
do $$
declare u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); targets jsonb:='[{"id":"board","name":"HiringCafe","kind":"board","address":"https://hiring.cafe"}]'; r jsonb;
begin
 insert into auth.users(id) values(u);
 insert into public.preferences(user_id,search) values(u,'{"defaultResumeId":"keep","autoSubmitApproved":false}');
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Targets test',h,array['workspace:read'],now()+interval '1 hour');
 begin
  perform public.agent_dispatch(h,'preferences.targets.save',jsonb_build_object('expectedVersion',0,'targets',targets));
  raise exception 'Write scope bypassed';
 exception when insufficient_privilege then null; end;
 update private.agent_connections set scopes=array['workspace:read','preferences:write'] where token_hash=h;
 r:=public.agent_dispatch(h,'preferences.targets.save',jsonb_build_object('expectedVersion',0,'targets',targets));
 if r->>'version'<>'1' then raise exception 'Wrong target version'; end if;
 begin
  perform public.agent_dispatch(h,'preferences.targets.save',jsonb_build_object('expectedVersion',0,'targets','[]'::jsonb));
  raise exception 'Stale overwrite accepted';
 exception when serialization_failure then null; end;
 begin
  perform private.save_search_targets_for_owner(u,1,'[{"id":"unsafe","name":"Unsafe","kind":"board","address":"javascript:alert(1)"}]');
  raise exception 'Unsafe address accepted';
 exception when invalid_parameter_value then null; end;
 perform set_config('test.uid',u::text,true);
 execute 'set local role authenticated';
 r:=public.save_search_targets(1,targets||'[{"id":"social","name":"Community","kind":"social","address":"@zero2sudo"}]');
 if r->>'version'<>'2' then raise exception 'UI version mismatch'; end if;
 perform public.save_workspace_preferences('{"defaultResumeId":"keep","autoSubmitApproved":false,"targets":[],"targetsVersion":0}','[]',null,'{}');
 if (select jsonb_array_length(search->'targets') from public.preferences where user_id=u)<>2 then raise exception 'Autosync overwrote targets'; end if;
 r:=public.save_search_targets(2,'[]');
 if r->>'version'<>'3' or r->'targets'<>'[]' then raise exception 'Removal failed'; end if;
 execute 'reset role';
 if (select search->>'defaultResumeId' from public.preferences where user_id=u)<>'keep' then raise exception 'Unrelated settings overwritten'; end if;
 update private.agent_connections set revoked_at=now() where token_hash=h;
 begin
  perform public.agent_dispatch(h,'preferences.targets.save',jsonb_build_object('expectedVersion',3,'targets',targets));
  raise exception 'Revoked credential accepted';
 exception when invalid_authorization_specification then null; end;
end $$;
rollback;
