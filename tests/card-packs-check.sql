begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); cid uuid:=gen_random_uuid(); foreign_cid uuid:=gen_random_uuid(); pack uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); h2 text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); cfg jsonb; schedule jsonb; saved jsonb; r jsonb; payload jsonb; bid uuid; stamp timestamptz;
begin
 insert into auth.users(id) values(u),(other_u);
 insert into private.agent_connections(id,user_id,name,token_hash,scopes,expires_at) values(cid,u,'Pack agent',h,array['workspace:read','preferences:write','batches:write'],now()+interval '1 hour'),(foreign_cid,other_u,'Other owner',h2,array['workspace:read','preferences:write','batches:write'],now()+interval '1 hour');
 insert into public.preferences(user_id,search,theme) values(u,'{"targets":[{"id":"my-source","kind":"social","name":"My source","address":"@fictional"}]}','{"pack":"solar"}') returning updated_at into stamp;
 perform set_config('test.uid',u::text,true);
 schedule:=jsonb_build_object('enabled',false,'timezone','UTC','configVersion',1,'routines',jsonb_build_array(jsonb_build_object('id','discovery','title','Discover roles','description','Verify employer links','mode','manual','time','','enabled',true,'sourceIds',jsonb_build_array('my-source'),'connectionIds',jsonb_build_array(cid))));
 saved:=public.configure_card_pack_preferences('preferences.notifications.save',jsonb_build_object('settings',jsonb_build_object('schedule',schedule),'expectedUpdatedAt',stamp));
 cfg:=jsonb_build_array(jsonb_build_object('id',pack,'title','My pack','enabled',true,'taskId','discovery','archive','none'));
 saved:=public.configure_card_pack_preferences('preferences.theme.save',jsonb_build_object('theme',jsonb_build_object('pack','solar','cardPacks',cfg,'cardPacksVersion',1),'expectedUpdatedAt',saved->>'updated_at'));
 begin perform public.configure_card_pack_preferences('profile.save','{}');raise exception 'Unscoped browser operation accepted';exception when invalid_parameter_value then null;end;
 begin perform public.configure_card_pack_preferences('preferences.notifications.save',jsonb_build_object('settings',jsonb_build_object('schedule',schedule),'expectedUpdatedAt',stamp));raise exception 'Stale browser settings accepted';exception when serialization_failure then null;end;
 if saved#>>'{theme,cardPacks,0,taskId}'<>'discovery' then raise exception 'Browser setup failed';end if;
 begin
  perform public.agent_dispatch(h,'preferences.theme.save',jsonb_build_object('theme',jsonb_build_object('cardPacks',cfg,'cardPacksVersion',3),'expectedUpdatedAt',saved->>'updated_at'));
  raise exception 'Skipped version accepted';exception when serialization_failure then null;end;
 begin
  perform public.agent_dispatch(h,'preferences.theme.save',jsonb_build_object('theme',jsonb_build_object('cardPacks',jsonb_set(cfg,'{0,taskId}','"missing"'),'cardPacksVersion',2),'expectedUpdatedAt',saved->>'updated_at'));
  raise exception 'Unknown task accepted';exception when invalid_parameter_value then null;end;
 begin
  perform public.agent_dispatch(h,'preferences.notifications.save',jsonb_build_object('settings',jsonb_build_object('schedule',jsonb_set(jsonb_set(schedule,'{configVersion}','2'),'{routines,0,connectionIds}',jsonb_build_array(foreign_cid))),'expectedUpdatedAt',saved->>'updated_at'));
  raise exception 'Foreign connection accepted';exception when insufficient_privilege then null;end;
 begin
  perform public.agent_dispatch(h,'preferences.notifications.save',jsonb_build_object('settings',jsonb_build_object('schedule',jsonb_set(jsonb_set(schedule,'{configVersion}','2'),'{routines,0,sourceIds}','["unknown"]')),'expectedUpdatedAt',saved->>'updated_at'));
  raise exception 'Unknown source accepted';exception when invalid_parameter_value then null;end;
 update public.preferences set theme='{"pack":"base"}',search=search-'schedule' where user_id=u;
 if (select theme#>>'{cardPacks,0,title}' from public.preferences where user_id=u)<>'My pack' or (select search#>>'{schedule,routines,0,id}' from public.preferences where user_id=u)<>'discovery' then raise exception 'Autosync erased widgets or task';end if;
 update public.preferences set theme='{"pack":"solar","cardPacks":[],"cardPacksVersion":0}',search=jsonb_set(search,'{schedule,routines}','[]') where user_id=u;
 if (select jsonb_array_length(theme->'cardPacks') from public.preferences where user_id=u)<>1 or (select jsonb_array_length(search#>'{schedule,routines}') from public.preferences where user_id=u)<>1 then raise exception 'Stale autosync erased settings';end if;
 insert into public.jobs(id,canonical_url,employer) values('pack-test-job','https://example.com/pack-test-job','{"company":"Fictional Systems","title":"Engineer","employmentType":"FT"}');
 payload:=jsonb_build_object('eventKey','same-event','label','Pack run','date','2026-10-23','jobs',jsonb_build_array(jsonb_build_object('jobId','pack-test-job','recommendation',jsonb_build_object('cardPackId',pack,'sourceId','my-source','dropStatus','pending','publisherConnectionId',foreign_cid,'automationTaskId','spoof','note','Unverified agent assessment'))));
 r:=public.agent_dispatch(h,'batches.publish',payload);bid:=(r#>>'{batch,id}')::uuid;
 if r#>>'{items,0,recommendation,publisherConnectionId}'<>cid::text or r#>>'{items,0,recommendation,automationTaskId}'<>'discovery' or r#>>'{batch,source_event_id}' not like 'card-pack:'||pack::text||':%' then raise exception 'Publisher spoof or pack routing lost';end if;
 if public.agent_dispatch(h,'batches.publish',payload)#>>'{batch,id}'<>bid::text then raise exception 'Retry duplicated batch';end if;
 begin perform public.agent_dispatch(h2,'batches.publish',payload);raise exception 'Foreign pack accepted';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(h,'batches.publish',jsonb_set(payload,'{jobs,0,recommendation,sourceId}','"unknown"'));raise exception 'Foreign source accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(h,'batches.publish',payload#-'{jobs,0,recommendation,sourceId}');raise exception 'Missing source accepted';exception when invalid_parameter_value then null;end;
 begin perform public.agent_dispatch(h,'batches.publish',jsonb_build_object('eventKey','card-pack:'||pack::text||':spoof','label','Spoof','jobs','[]'::jsonb));raise exception 'Forged routing accepted';exception when invalid_parameter_value then null;end;
 update public.preferences set search=jsonb_set(jsonb_set(search,'{schedule,configVersion}','2'),'{schedule,routines,0,enabled}','false') where user_id=u;
 begin perform public.agent_dispatch(h,'batches.publish',payload);raise exception 'Paused task accepted';exception when insufficient_privilege then null;end;
 update public.preferences set search=jsonb_set(jsonb_set(jsonb_set(search,'{schedule,configVersion}','3'),'{schedule,routines,0,enabled}','true'),'{schedule,routines,0,connectionIds}','[]') where user_id=u;
 begin perform public.agent_dispatch(h,'batches.publish',payload);raise exception 'Unassigned publisher accepted';exception when insufficient_privilege then null;end;
 update public.preferences set search=jsonb_set(jsonb_set(search,'{schedule,configVersion}','4'),'{schedule,routines,0,connectionIds}',jsonb_build_array(cid)) where user_id=u;
 update private.agent_connections set revoked_at=now() where id=cid;
 begin perform public.agent_dispatch(h,'batches.publish',payload);raise exception 'Revoked publisher accepted';exception when invalid_authorization_specification then null;end;
 update private.agent_connections set revoked_at=null where id=cid;
 update public.preferences set search=jsonb_set(jsonb_set(search,'{schedule,configVersion}','5'),'{schedule,routines}','[]') where user_id=u;
 begin perform public.agent_dispatch(h,'batches.publish',payload);raise exception 'Deleted task accepted';exception when no_data_found then null;end;
 if (select count(*) from public.job_batches where user_id=u)<>1 then raise exception 'Failed publishing created data';end if;
 perform set_config('test.uid',other_u::text,true);
 execute 'set local role authenticated';
 if exists(select 1 from public.job_batches where id=bid) or exists(select 1 from public.preferences where user_id=u) then raise exception 'Cross-owner read leak';end if;
 execute 'reset role';
end $$;
rollback;
