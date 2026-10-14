begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); answer_id uuid:=gen_random_uuid(); r jsonb; stamp text;
begin
 insert into auth.users(id) values(u),(other_u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Product tests',h,array['workspace:read'],now()+interval '1 hour');
 begin
  perform public.agent_dispatch(h,'profile.save','{"facts":{"name":"Test"},"expectedUpdatedAt":null}');
  raise exception 'Missing scope allowed';
 exception when insufficient_privilege then null; end;
 update private.agent_connections set scopes=array['workspace:read','profile:write','answers:write','preferences:write','activity:write'] where token_hash=h;
 r:=public.agent_dispatch(h,'profile.save','{"facts":{"name":"Test"},"expectedUpdatedAt":null}');
 if r->>'verified_at' is not null or r->>'user_id'<>u::text then raise exception 'Facts verified or foreign'; end if;
 begin
  perform public.agent_dispatch(h,'profile.save','{"facts":{},"expectedUpdatedAt":null}');
  raise exception 'Stale edit allowed';
 exception when serialization_failure then null; end;
 r:=public.agent_dispatch(h,'answers.save',jsonb_build_object('id',answer_id,'question','Why?','answer','My own facts','companyScope',null,'expectedUpdatedAt',null));
 if r->>'provenance'<>'agent' or r->>'autofill_policy'<>'ask' or r->>'verified_at' is not null then raise exception 'Answer forged consent'; end if;
 stamp:=r->>'updated_at';
 perform public.agent_dispatch(h,'answers.delete',jsonb_build_object('id',answer_id,'expectedUpdatedAt',stamp));
 if exists(select 1 from public.answer_library where id=answer_id) then raise exception 'Answer not deleted'; end if;
 r:=public.agent_dispatch(h,'preferences.notifications.save','{"settings":{"quietMode":{"cadence":"weekly"}},"expectedUpdatedAt":null}');
 stamp:=r->>'updated_at';
 begin
  perform public.agent_dispatch(h,'preferences.notifications.save',jsonb_build_object('settings','{"autoSubmitApproved":true}'::jsonb,'expectedUpdatedAt',stamp));
  raise exception 'Permission injection allowed';
 exception when invalid_parameter_value then null; end;
 r:=public.agent_dispatch(h,'preferences.theme.save',jsonb_build_object('theme','{"pack":"fictional"}'::jsonb,'expectedUpdatedAt',stamp));
 if r#>>'{search,quietMode,cadence}'<>'weekly' then raise exception 'Other settings lost'; end if;
 r:=public.agent_dispatch(h,'jobs.list','{"limit":10,"offset":0}');
 if jsonb_typeof(r)<>'array' then raise exception 'Catalog unreadable'; end if;
 r:=public.agent_dispatch(h,'human.request','{"action":"verify-profile","recordId":null}');
 if r->>'executed'<>'false' or r->>'requiresHuman'<>'true' then raise exception 'Handoff executed'; end if;
 if exists(select 1 from public.preferences where user_id=other_u) or exists(select 1 from public.profiles where user_id=other_u) then raise exception 'Other owner touched'; end if;
end $$;
rollback;
