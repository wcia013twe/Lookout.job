begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid(); h text:=md5(random()::text); ro text:=md5(random()::text); other_h text:=md5(random()::text); r jsonb; app_before jsonb; request jsonb; j text:='dismiss-'||gen_random_uuid()::text;
begin
 insert into auth.users(id) values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values
 (u,'writer',h,array['workspace:read','activity:write'],now()+interval '1 hour'),
 (u,'reader',ro,array['workspace:read'],now()+interval '1 hour'),
 (v,'other',other_h,array['workspace:read','activity:write'],now()+interval '1 hour');
 insert into public.jobs(id,canonical_url,employer) values(j,'https://example.com/'||j,'{}');
 insert into public.job_batches(id,user_id,label,source_event_id) values(b,u,'Test','dismiss-one'),(b2,u,'Other batch','dismiss-two');
 insert into public.batch_items(user_id,batch_id,job_id,position) values(u,b,j,0),(u,b2,j,0);
 insert into public.applications(user_id,job_id,status) values(u,j,'Interview');
 select to_jsonb(a) into app_before from public.applications a where a.user_id=u and a.job_id=j;
 request:=jsonb_build_object('batchId',b,'jobId',j);
 begin perform public.agent_dispatch(ro,'batches.item.dismiss',request);raise exception 'Scope bypass';exception when insufficient_privilege then null;end;
 begin perform public.agent_dispatch(other_h,'batches.item.dismiss',request);raise exception 'Owner bypass';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(h,'batches.item.dismiss',request||'{"userId":"x"}');raise exception 'Extra argument accepted';exception when invalid_parameter_value then null;end;
 r:=public.agent_dispatch(h,'batches.item.dismiss',request);
 if r is distinct from public.agent_dispatch(h,'batches.item.dismiss',request) then raise exception 'Retry changed result';end if;
 if not exists(select 1 from public.batch_items where batch_id=b and job_id=j and dismissed_at is not null) then raise exception 'Item not dismissed';end if;
 if not exists(select 1 from public.batch_items where batch_id=b2 and job_id=j and dismissed_at is null) then raise exception 'Other batch changed';end if;
 if (select to_jsonb(a) from public.applications a where a.user_id=u and a.job_id=j) is distinct from app_before then raise exception 'Application changed';end if;
 if not exists(select 1 from public.jobs where id=j) then raise exception 'Job changed';end if;
 if not exists(select 1 from jsonb_array_elements(public.agent_dispatch(h,'batches.read',jsonb_build_object('batchId',b))->'items') x where x->>'job_id'=j and x->>'dismissed_at' is not null) then raise exception 'Read-back missing'; end if;
 perform set_config('test.uid',v::text,true);
 begin perform public.dismiss_batch_item(b2,j);raise exception 'Website owner bypass';exception when no_data_found then null;end;
 perform set_config('test.uid',u::text,true);
 perform public.dismiss_batch_item(b2,j);
 if not exists(select 1 from public.batch_items where batch_id=b2 and dismissed_at is not null) then raise exception 'Website action failed';end if;
end $$;
rollback;
