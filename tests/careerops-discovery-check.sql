begin;
do $$
declare u uuid:=gen_random_uuid();h text:=repeat('d',64);j jsonb;c jsonb;r jsonb;f jsonb;x jsonb;rows jsonb:='[]';n integer;
begin
 insert into auth.users values(u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Fictional copied scanner check',h,array['workspace:read','preferences:write','drafts:write'],now()+interval '1 day');
 insert into public.search_documents(user_id,kind,id,version,content,projection) values(u,'profile','fixture',1,'{}','{"active":true}'),(u,'portals','shared',1,'{}','{"tracked_companies":[{"id":"test","name":"Fictional","enabled":true}],"search_queries":[]}');
 j:=public.backend_job_dispatch(h,'backend.jobs.submit','{"kind":"search_ats","input":{"profileId":"fixture"},"eventKey":"copy-check"}');
 c:=public.backend_worker('claim','{}');
 f:=jsonb_build_object('jobId',j->>'id','leaseToken',c->>'leaseToken','expectedVersion',c->'job'->'version');
 r:=public.backend_worker('dispatch',f||jsonb_build_object('operation','search.run.start','payload',jsonb_build_object('profileId','fixture','eventKey','job:'||(j->>'id')||':start')));
 for n in 1..3 loop
  x:=jsonb_build_object('sourceId','portal:test','url',case when n<3 then 'https://example.com/job?ref='||n else 'https://job-boards.greenhouse.io/example/jobs/111' end,'company','Fictional','title','Backend Engineer','location','Remote','checkedAt',now(),'liveness','active','evidence','Fictional integration observation','employerPostedAt',null,'sourceListAgeDays',null,'description','Fictional integration description');
  if n=3 then x:=x||'{"atsIdentity":"greenhouse:example:111","requisitionId":"REQ-111"}'::jsonb;end if;
  rows:=rows||jsonb_build_array(x);
 end loop;
 perform public.backend_worker('dispatch',f||jsonb_build_object('operation','search.discoveries.save','payload',jsonb_build_object('runId',r->>'id','listings',rows,'eventKey','job:'||(j->>'id')||':save')));
 if (select count(*) from public.search_listings where user_id=u)<>3 then raise exception 'Functional URL parameters collapsed distinct postings';end if;
 if not exists(select 1 from public.search_listings where user_id=u and canonical_url='https://example.com/job?ref=1') or not exists(select 1 from public.search_listings where user_id=u and canonical_url='https://example.com/job?ref=2') then raise exception 'Functional URL canonicalization changed';end if;
 x:=public.backend_worker('dispatch',f||jsonb_build_object('operation','search.discoveries.read','payload',jsonb_build_object('runId',r->>'id','offset',0,'limit',100)));
 if not exists(select 1 from jsonb_array_elements(x->'listings') item where item->>'identity'='ats:greenhouse:example:111' and item->>'requisitionId'='REQ-111') then raise exception 'Resume lost native provider identity';end if;
 if exists(select 1 from jsonb_array_elements(x->'listings') item where item ?| array['screening','applications','description','leaseToken']) then raise exception 'Bounded resume leaked unrelated context';end if;
end $$;
rollback;
