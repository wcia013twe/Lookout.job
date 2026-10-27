begin;
do $$
declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();h text:=repeat('a',64);h2 text:=repeat('b',64);hr text:=repeat('c',64);p jsonb;r jsonb;req jsonb;x jsonb;result jsonb;l uuid;obs uuid;ctx jsonb;plan jsonb;
begin
 insert into auth.users values(u),(v);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Pipeline',h,array['workspace:read','drafts:write','preferences:write'],now()+interval '1 day'),(v,'Other',h2,array['workspace:read','drafts:write'],now()+interval '1 day'),(u,'Reader',hr,array['workspace:read'],now()+interval '1 day');
 p:='{"id":"general","name":"General","active":true,"filters":{"Employment":"Full-time"},"priorities":{},"instructions":"Preserve this prose."}';
 perform private.save_search_profile_for_owner(u,0,p);
 perform public.agent_dispatch(h,'search.document.save','{"kind":"portals","id":"shared","content":"{\"tracked_companies\":[{\"id\":\"board\",\"name\":\"Example\",\"kind\":\"board\",\"careers_url\":\"https://example.com\",\"enabled\":true}],\"search_queries\":[]}","expectedVersion":0,"eventKey":"pipeline-portals"}');
 r:=public.agent_dispatch(h,'search.run.start','{"profileId":"general","eventKey":"pipeline-run"}');
 req:=jsonb_build_object('runId',r->>'id','sourceId','portal:board','leads','[{"url":"https://example.com/job"}]'::jsonb,'eventKey','pipeline-leads');
 if public.agent_dispatch(h,'search.leads.read',jsonb_build_object('request',req)) is not null then raise exception 'Unexpected replay';end if;
 begin perform public.agent_dispatch(h2,'search.leads.read',jsonb_build_object('request',req));raise exception 'Cross-owner accepted';exception when no_data_found then null;end;
 begin perform public.agent_dispatch(hr,'search.leads.read',jsonb_build_object('request',req));raise exception 'Read-only credential wrote';exception when insufficient_privilege then null;end;
 x:=jsonb_build_object('sourceId','portal:board','url','https://example.com/job','company','Example','title','Engineer','location','Remote','checkedAt',now(),'liveness','active','evidence','Fictional official posting','employerPostedAt',null,'sourceListAgeDays',null,'description','Fictional full job description');
 result:=public.agent_dispatch(h,'search.leads.commit',jsonb_build_object('request',req,'observations',jsonb_build_array(x),'diagnostics','[{"url":"https://example.com/job","status":"active","reason":"Fictional verified source"}]'::jsonb));
 if public.agent_dispatch(h,'search.leads.read',jsonb_build_object('request',req))<>result then raise exception 'Lead replay failed';end if;
 if (select count(*) from public.search_observations where user_id=u)<>1 then raise exception 'Duplicate observations';end if;
 begin perform public.agent_dispatch(h,'search.leads.read',jsonb_build_object('request',req||'{"sourceId":"forged"}'));raise exception 'Forged source accepted';exception when invalid_parameter_value then null;end;
 l:=(result#>>'{saved,0,listingId}')::uuid;obs:=(result#>>'{saved,0,observationId}')::uuid;
 req:=jsonb_build_object('runId',r->>'id','listingIds',jsonb_build_array(l::text),'eventKey','pipeline-screen');ctx:=public.agent_dispatch(h,'search.context','{"profileId":"general"}');
 plan:=jsonb_build_object('request',req,'expectedPersonalVersion',ctx->'personalVersion','expectedProfileVersion',1,'screenings',jsonb_build_array(jsonb_build_object('listingId',l,'observationId',obs,'expectedVersion',0,'decision','review-needed','checks','[]'::jsonb,'explanation','Unresolved personal eligibility remains explicit.')));
 begin perform public.agent_dispatch(h,'search.screenings.commit',plan||'{"expectedPersonalVersion":0}');raise exception 'Stale settings accepted';exception when serialization_failure then null;end;
 result:=public.agent_dispatch(h,'search.screenings.commit',plan);
 if public.agent_dispatch(h,'search.screenings.read',jsonb_build_object('request',req))<>result then raise exception 'Screening replay failed';end if;
 if (select count(*) from public.search_screenings where user_id=u)<>1 then raise exception 'Duplicate screenings';end if;
 -- A current changed profile can rescreen the original observations.
 perform private.save_search_profile_for_owner(u,1,p||'{"filters":{"Employment":"Internship"}}');ctx:=public.agent_dispatch(h,'search.context','{"profileId":"general"}');
 req:=req||'{"eventKey":"pipeline-rescreen"}';plan:=jsonb_set(plan,'{screenings,0,expectedVersion}','1');plan:=plan||jsonb_build_object('request',req,'expectedPersonalVersion',ctx->'personalVersion','expectedProfileVersion',2);
 result:=public.agent_dispatch(h,'search.screenings.commit',plan);if result->>'evaluatedProfileVersion'<>'2' then raise exception 'Current profile not used';end if;
 if exists(select 1 from public.applications where user_id=u) or exists(select 1 from public.job_batches where user_id=u) then raise exception 'Screening minted application or publication';end if;
end $$;
rollback;
