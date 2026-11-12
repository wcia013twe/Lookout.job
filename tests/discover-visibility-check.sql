begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); h text:=md5(random()::text); ro text:=md5(random()::text); other_h text:=md5(random()::text); j text:='visibility-'||gen_random_uuid()::text; request jsonb; p public.preferences;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values (u,'writer',h,array['workspace:read','activity:write'],now()+interval '1 hour'),(u,'reader',ro,array['workspace:read'],now()+interval '1 hour'),(v,'other',other_h,array['activity:write'],now()+interval '1 hour');
 insert into public.jobs(id,canonical_url,employer) values(j,'https://example.com/'||j,'{}');
 insert into public.job_batches(id,user_id,label,source_event_id) values(b,u,'Test','visibility-test');
 insert into public.batch_items(user_id,batch_id,job_id,position) values(u,b,j,0);
 request:=jsonb_build_object('jobId',j,'visibility','hidden');
 begin perform public.agent_dispatch(ro,'discover.visibility.set',request);raise exception 'Scope bypass';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(other_h,'discover.visibility.set',request);raise exception 'Owner bypass';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(h,'discover.visibility.set',request||'{"userId":"x"}');raise exception 'Extra argument accepted';exception when invalid_parameter_value then null;end;
 perform public.agent_dispatch(h,'discover.visibility.set',request);
 perform set_config('test.uid',u::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.save_preferences_preserving_quiet('{"other":true,"discoverVisibility":{}}','[]',null,'{}');
 select * into p from public.preferences where user_id=u;
 if p.search->'discoverVisibility'->>j is distinct from 'hidden' then raise exception 'Bulk save lost visibility'; end if;
 perform public.set_discover_visibility(j,'visible');
 if (select search->'discoverVisibility'->>j from public.preferences where user_id=u) is distinct from 'visible' then raise exception 'Website restore failed'; end if;
 if not exists(select 1 from public.batch_items where user_id=u and job_id=j and dismissed_at is null) then raise exception 'Batch changed'; end if;
end $$;
rollback;
