begin;
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); h text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); run uuid:=gen_random_uuid(); listing uuid:=gen_random_uuid(); payload jsonb; result jsonb; full_jd text:=E'Responsibilities\nBuild storage systems.\nRequirements\nDatabase experience.\nBenefits\nPaid leave.';
begin
 insert into auth.users(id) values(u),(other_u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'JD fixture',h,array['workspace:read','batches:write'],now()+interval '1 hour');
 insert into public.search_runs(id,user_id,profile_id,context_snapshot,mode,days) values(run,u,'fixture','{}','fresh',3);
 insert into public.search_source_attempts(user_id,run_id,source_id,source) values(u,run,'fixture','{}');
 insert into public.search_listings(id,user_id,identity,canonical_url,company,title,match_key) values(listing,u,'fixture-jd','https://example.com/publish-jd','Fictional Systems','Engineer','fixture-jd');
 insert into public.search_observations(user_id,listing_id,run_id,source_id,checked_at,liveness,evidence,description,observed_url) values
 (u,listing,run,'fixture',now()-interval '1 hour','active','Fictional capture','Earlier capture','https://example.com/publish-jd'),
 (u,listing,run,'fixture',now(),'active','Fictional capture',full_jd,'https://example.com/publish-jd');
 payload:=jsonb_build_object('eventKey','publish-jd','label','Fictional JD proof','jobs',jsonb_build_array(jsonb_build_object('canonicalUrl','https://example.com/publish-jd','employer',jsonb_build_object('company','Fictional Systems','title','Engineer','description','Agent summary'),'recommendation',jsonb_build_object('whyItFits','Separate personal analysis'))));
 result:=public.agent_dispatch(h,'batches.publish',payload);
 if (select employer->>'description' from public.jobs where canonical_url='https://example.com/publish-jd') is distinct from full_jd then raise exception 'Publication did not copy latest full JD';end if;
 if result#>>'{items,0,recommendation,whyItFits}' is distinct from 'Separate personal analysis' then raise exception 'Fit analysis changed';end if;
 -- Both ID and URL publication preserve the existing catalog description.
 perform public.agent_dispatch(h,'batches.publish',jsonb_set(payload,'{eventKey}','"publish-jd-url"'));
 perform public.agent_dispatch(h,'batches.publish',jsonb_build_object('eventKey','publish-jd-id','label','ID proof','jobs',jsonb_build_array(jsonb_build_object('jobId','agent-'||md5('https://example.com/publish-jd')))));
 if (select employer->>'description' from public.jobs where canonical_url='https://example.com/publish-jd') is distinct from full_jd then raise exception 'Existing JD overwritten';end if;
 -- Another account cannot copy this owner's capture. No capture means no JD.
 update private.agent_connections set user_id=other_u where token_hash=h;
 delete from public.batch_items where user_id=u;
 delete from public.jobs where canonical_url='https://example.com/publish-jd';
 perform public.agent_dispatch(h,'batches.publish',jsonb_set(payload,'{eventKey}','"publish-jd-other-owner"'));
 if (select employer->>'description' from public.jobs where canonical_url='https://example.com/publish-jd') is distinct from '' then raise exception 'Foreign capture or agent summary accepted';end if;
 -- Retry keeps the immutable original batch.
 if public.agent_dispatch(h,'batches.publish',jsonb_set(payload,'{eventKey}','"publish-jd-other-owner"'))#>>'{batch,id}' is null then raise exception 'Retry failed';end if;
end $$;
rollback;
