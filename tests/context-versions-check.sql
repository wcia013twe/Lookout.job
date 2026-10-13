begin;
do $$
declare u uuid:=gen_random_uuid(); other_user uuid:=gen_random_uuid();
  key_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  blocked_hash text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
  version_before bigint; version_after bigint; bundle jsonb; resume_id uuid; answer_id uuid;
begin
  insert into auth.users(id) values(u),(other_user);
  insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
    values(u,'Context test',key_hash,array['workspace:read'],now()+interval '1 hour'),
      (other_user,'No workspace scope',blocked_hash,array['activity:write'],now()+interval '1 hour');
  bundle:=public.agent_dispatch(key_hash,'context.versions','{}');
  if bundle <> '{"personalVersion":1}'::jsonb then raise exception 'First version wrong'; end if;
  insert into public.profiles(user_id,facts) values(u,'{"name":"Context test"}'),(other_user,'{"name":"Other user"}');
  version_before:=(public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint;
  if version_before <> 2 then raise exception 'Owner-specific insert version wrong'; end if;
  update public.profiles set updated_at=now()+interval '1 second' where user_id=u;
  if (public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint <> version_before then raise exception 'No-op changed version'; end if;
  update public.profiles set facts='{"name":"Edited"}' where user_id=other_user;
  if (public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint <> version_before then raise exception 'Cross-owner version changed'; end if;
  insert into public.preferences(user_id,theme) values(u,'{"pack":"base","messages":{"batch_ready":"A pack appeared"}}');
  insert into public.resumes(user_id,name,reference_url) values(u,'Master','https://example.com/resume.pdf') returning id into resume_id;
  insert into public.answer_library(user_id,question,answer,provenance) values(u,'Why?','Because','user') returning id into answer_id;
  version_after:=(public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint;
  if version_after <> version_before+3 then raise exception 'Settings triggers missing'; end if;
  bundle:=public.agent_dispatch(key_hash,'context.personal','{}');
  if (bundle->>'personalVersion')::bigint <> version_after or bundle->'settings'->'profile'->'facts'->>'name' <> 'Context test'
    or jsonb_array_length(bundle->'settings'->'answers') <> 1 or jsonb_array_length(bundle->'settings'->'resumes') <> 1
    or bundle->'settings'->'preferences'->'theme'->'messages'->>'batch_ready' <> 'A pack appeared'
    or bundle->'settings' ? 'applications' then raise exception 'Personal context contents wrong'; end if;
  -- Account history does not cause prompt/settings reloads.
  insert into public.activity_events(user_id,event_key,kind,actor) values(u,'context-test','observation','agent');
  if (public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint <> version_after then raise exception 'History invalidated settings'; end if;
  delete from public.answer_library where id=answer_id;
  delete from public.resumes where id=resume_id;
  if (public.agent_dispatch(key_hash,'context.versions','{}')->>'personalVersion')::bigint <> version_after+2 then raise exception 'Deletes did not advance version'; end if;
  -- Two agents can check without consuming/resetting another agent's update.
  if public.agent_dispatch(key_hash,'context.versions','{}') <> public.agent_dispatch(key_hash,'context.versions','{}') then raise exception 'Version check mutated state'; end if;
  begin perform public.agent_dispatch(blocked_hash,'context.versions','{}'); raise exception 'Scope accepted'; exception when insufficient_privilege then null; end;
  begin perform public.agent_dispatch(key_hash,'context.personal',jsonb_build_object('userId',other_user)); raise exception 'Owner injection accepted'; exception when invalid_parameter_value then null; end;
  update private.agent_connections set revoked_at=now() where token_hash=key_hash;
  begin perform public.agent_dispatch(key_hash,'context.versions','{}'); raise exception 'Revocation accepted'; exception when invalid_authorization_specification then null; end;
  delete from auth.users where id=u;
  if exists(select 1 from private.agent_settings_versions where user_id=u) then raise exception 'Cascade retained version'; end if;
end $$;
rollback;
