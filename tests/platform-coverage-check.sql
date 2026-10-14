begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); r jsonb; stamp text; resume_id uuid:=gen_random_uuid(); batch uuid:=gen_random_uuid(); j text:='coverage-'||gen_random_uuid(); decision uuid;
begin
 insert into auth.users(id) values(u),(other_u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Coverage',h,array['workspace:read','preferences:write','activity:write'],now()+interval '1 hour');
 r:=public.agent_dispatch(h,'preferences.tiers.save','{"tierLists":[],"activeTierListId":null,"expectedUpdatedAt":null}');stamp:=r->>'updated_at';
 insert into public.resumes(id,user_id,name,object_path) values(resume_id,u,'Fictional',u::text||'/fixture.pdf');
 r:=public.agent_dispatch(h,'preferences.resumes.save',jsonb_build_object('defaultResumeId',resume_id,'resumeRules','[]'::jsonb,'expectedUpdatedAt',stamp));
 if r#>>'{search,defaultResumeId}'<>resume_id::text then raise exception 'Resume preferences missing'; end if;
 begin
  perform public.agent_dispatch(h,'preferences.resumes.save',jsonb_build_object('defaultResumeId',gen_random_uuid(),'resumeRules','[]'::jsonb,'expectedUpdatedAt',r->>'updated_at'));
  raise exception 'Foreign resume selected';
 exception when no_data_found then null; end;
 insert into public.jobs(id,canonical_url,employer) values(j,'https://example.com/'||j,'{}');
 insert into public.job_batches(id,user_id,label,source_event_id) values(batch,u,'Fictional','coverage');
 insert into public.batch_items(user_id,batch_id,job_id,position) values(u,batch,j,0);
 r:=public.agent_dispatch(h,'batches.read',jsonb_build_object('batchId',batch));
 if jsonb_array_length(r->'items')<>1 then raise exception 'Batch unreadable'; end if;
 r:=public.agent_dispatch(h,'batches.item.mark',jsonb_build_object('batchId',batch,'jobId',j,'action','saved'));
 if r->>'saved_at' is null then raise exception 'Not saved'; end if;
 insert into public.selection_decisions(user_id,job_id,event_key,reason,preference,evidence,certainty,personal_version) values(u,j,'coverage','Example','fit','Example','uncertain',1) returning id into decision;
 r:=public.agent_dispatch(h,'selection.reconsider.simple',jsonb_build_object('id',decision));
 if r->>'reconsidered_at' is null then raise exception 'Not reconsidered'; end if;
 r:=public.agent_dispatch(h,'leaderboard.read','{"limit":10}');
 if jsonb_typeof(r)<>'array' or exists(select 1 from jsonb_array_elements(r) x where x ? 'user_id') then raise exception 'Private leaderboard data'; end if;
 perform set_config('test.uid',u::text,true);
 execute 'set local role authenticated';
 r:=public.perform_platform_action('preferences.theme.save',jsonb_build_object('theme','{"pack":"test"}'::jsonb,'expectedUpdatedAt',stamp));
 if r->>'user_id'<>u::text then raise exception 'Browser owner wrong'; end if;
 begin
  perform public.perform_platform_action('resumes.upload.finalize',jsonb_build_object('id',resume_id));
  raise exception 'Browser bypassed byte verification';
 exception when invalid_parameter_value then null; end;
 execute 'reset role';
end $$;
rollback;
