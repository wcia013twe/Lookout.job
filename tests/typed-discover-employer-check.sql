begin;
do $$
declare u uuid:=gen_random_uuid();h text:=repeat('f',64);p jsonb;result jsonb;owner_revision integer;
begin
 insert into auth.users(id) values(u);
 insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at) values(u,'Typed discovery fixture',h,array['workspace:read','batches:write','preferences:write','drafts:write','approvals:read','resumes:read'],now()+interval '1 hour');
 p:='{"eventKey":"typed-new","label":"Typed fixture","jobs":[{"canonicalUrl":"https://job-boards.greenhouse.io/fixture/jobs/98765","employer":{"company":"Fictional","title":"Engineer","employmentType":"Full-time","location":"Remote"}}]}';
 result:=public.agent_dispatch(h,'batches.publish',p);
 if (select employer->>'employmentType' from public.jobs where canonical_url='https://job-boards.greenhouse.io/fixture/jobs/98765') is distinct from 'FT' then raise exception 'Noncanonical type saved';end if;
 if public.agent_dispatch(h,'batches.publish',p)<>result then raise exception 'Immutable retry changed';end if;
 p:=jsonb_set(p,'{eventKey}','"typed-invalid"');p:=jsonb_set(p,'{jobs,0,employer,employmentType}','"Contract"');
 begin perform public.agent_dispatch(h,'batches.publish',p);raise exception 'Invalid type accepted';exception when invalid_parameter_value then null;end;
 if exists(select 1 from public.job_batches where user_id=u and source_event_id='typed-invalid') then raise exception 'Invalid batch partially saved';end if;
 p:=jsonb_set(p,'{eventKey}','"typed-missing"');p:=jsonb_set(p,'{jobs,0,employer}',(p#>'{jobs,0,employer}')-'employmentType');
 begin perform public.agent_dispatch(h,'batches.publish',p);raise exception 'Missing type accepted';exception when invalid_parameter_value then null;end;
 -- The exact saved employer facts now pass real AI Apply validation, authenticated
 -- as the owner; no employer page, approval or submission is involved.
 perform set_config('test.uid',u::text,true);
 result:=public.queue_application_job(jsonb_build_object('posting',jsonb_build_object('id','agent-'||md5('https://job-boards.greenhouse.io/fixture/jobs/98765'),'url','https://job-boards.greenhouse.io/fixture/jobs/98765','company','Fictional','title','Engineer','employmentType','FT','location','Remote'),'expectedRevision',0,'eventKey','typed-apply'));
 if result#>>'{job,status}' is distinct from 'queued' then raise exception 'Saved discovery could not queue';end if;
end $$;
rollback;
