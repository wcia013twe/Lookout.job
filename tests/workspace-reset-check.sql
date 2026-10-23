begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid(); reset_id uuid:=gen_random_uuid(); preview jsonb; result jsonb; before_version bigint; t text; n bigint;
begin
 insert into auth.users values(u),(other_user);
 insert into public.profiles(user_id,facts) values(u,'{"name":"Delete me"}'),(other_user,'{"name":"Keep me"}');
 insert into public.preferences(user_id) values(u);
 insert into public.answer_library(user_id,question,answer,provenance) values(u,'Why?','Old answer','user');
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Revoke me',repeat('a',64),array['workspace:read'],now()+interval '1 day');
 insert into storage.objects(bucket_id,name) values('resumes',u::text||'/old.pdf'),('resumes',other_user::text||'/keep.pdf');
 preview:=public.workspace_reset_service(u,'preview');
 if preview->>'state'<>'ready' or jsonb_array_length(preview->'files')<>1 then raise exception 'Wrong preview'; end if;
 before_version:=(preview->>'personalVersion')::bigint;
 begin perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','yes','expectedPersonalVersion',before_version));raise exception 'Missing human confirmation accepted';exception when invalid_parameter_value then null;end;
 begin perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',before_version+1));raise exception 'Stale preview accepted';exception when serialization_failure then null;end;
 result:=public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',before_version));
 if result->>'state'<>'pending' or exists(select 1 from private.agent_connections where user_id=u and revoked_at is null) then raise exception 'Connection not revoked';end if;
 begin update public.profiles set facts='{}' where user_id=u;raise exception 'Write during reset accepted';exception when object_not_in_prerequisite_state then null;end;
 begin perform public.workspace_reset_service(u,'finish',jsonb_build_object('resetId',reset_id));raise exception 'Files remain but finalized';exception when object_not_in_prerequisite_state then null;end;
 if not exists(select 1 from public.profiles where user_id=u) then raise exception 'File failure discarded records';end if;
 -- Simulate successful Storage API deletion in the disposable test only.
 delete from storage.objects where bucket_id='resumes' and name=u::text||'/old.pdf';
 result:=public.workspace_reset_service(u,'finish',jsonb_build_object('resetId',reset_id));
 if result->>'state'<>'completed' then raise exception 'Not completed';end if;
 foreach t in array private.workspace_reset_tables() loop
  execute format('select count(*) from %s where user_id=$1',t) into n using u;
  if n<>0 then raise exception 'Records remain in %',t;end if;
 end loop;
 if not exists(select 1 from auth.users where id=u) or not exists(select 1 from public.profiles where user_id=other_user and facts->>'name'='Keep me') or not exists(select 1 from storage.objects where name=other_user::text||'/keep.pdf') then raise exception 'Account or other owner changed';end if;
 if (select version from private.agent_settings_versions where user_id=u)<=before_version then raise exception 'Version reset or missing';end if;
 begin insert into storage.objects(bucket_id,name) values('resumes',u::text||'/old.pdf');raise exception 'Old signed path recreated';exception when object_not_in_prerequisite_state then null;end;
 insert into public.profiles(user_id,facts) values(u,'{"name":"New onboarding"}');
 perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',before_version));
 perform public.workspace_reset_service(u,'finish',jsonb_build_object('resetId',reset_id));
 if not exists(select 1 from public.profiles where user_id=u and facts->>'name'='New onboarding') then raise exception 'Replay wiped new work';end if;
 perform set_config('test.uid',other_user::text,true);
 if public.workspace_reset_state()<>'{}'::jsonb then raise exception 'Cross-owner reset state';end if;
 perform set_config('test.uid',u::text,true);
 if public.workspace_reset_state()->>'state'<>'completed' then raise exception 'Owner state unavailable';end if;
 -- Historic completed UUIDs must remain harmless after a newer reset.
 perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',gen_random_uuid(),'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',(select version from private.agent_settings_versions where user_id=u)));
 perform public.workspace_reset_service(u,'finish',jsonb_build_object('resetId',(select id from private.workspace_resets where user_id=u)));
 insert into public.profiles(user_id,facts) values(u,'{"name":"Keep newest onboarding"}');
 perform public.workspace_reset_service(u,'begin',jsonb_build_object('resetId',reset_id,'confirmation','RESET MY WORKSPACE','expectedPersonalVersion',before_version));
 if not exists(select 1 from public.profiles where user_id=u and facts->>'name'='Keep newest onboarding') then raise exception 'Historic replay erased new work';end if;
 perform set_config('role','authenticated',true);
 begin update public.profiles set facts='{}' where user_id=u;raise exception 'Stale session restored deleted content';exception when object_not_in_prerequisite_state then null;end;
 perform set_config('role','none',true);

end $$;
set local role authenticated;
do $$ begin
 begin perform public.workspace_reset_service('11111111-1111-1111-1111-111111111111','preview');raise exception 'Browser accessed reset service';exception when insufficient_privilege then null;end;
 begin select * from private.workspace_resets;raise exception 'Browser accessed reset records';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
