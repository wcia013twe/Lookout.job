begin;
-- Read published source revisions directly: metadata retrieval needs no vector staging.
create function private.interview_intelligence(actor uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.jobs; lim integer; evidence jsonb; app uuid; selected_job text;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('applicationId','jobId','stage','since','until','limit'))
  or ((payload ? 'applicationId')=(payload ? 'jobId')) then raise exception 'Choose applicationId or jobId' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(payload) e where e.key<>'limit' and (jsonb_typeof(e.value)<>'string' or length(trim(e.value#>>'{}')) not between 1 and 200))
  or (payload ? 'limit' and (jsonb_typeof(payload->'limit')<>'number' or payload->>'limit' !~ '^[0-9]+$')) then raise exception 'Invalid interview filter' using errcode='22023'; end if;
 lim:=coalesce((payload->>'limit')::int,10);
 if lim not between 1 and 10 then raise exception 'Limit must be 1 to 10' using errcode='22023'; end if;
 if payload ? 'since' and (payload->>'since' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((payload->>'since')::date,'YYYY-MM-DD')<>payload->>'since')
  or payload ? 'until' and (payload->>'until' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((payload->>'until')::date,'YYYY-MM-DD')<>payload->>'until')
  or payload ? 'since' and payload ? 'until' and (payload->>'since')::date>(payload->>'until')::date then raise exception 'Invalid interview date range' using errcode='22023'; end if;
 if payload ? 'applicationId' then
  app:=(payload->>'applicationId')::uuid;
  select a.job_id into selected_job from public.applications a where a.id=app and a.user_id=actor;
  if not found then raise exception 'Owned application not found' using errcode='P0002'; end if;
 else selected_job:=payload->>'jobId'; end if;
 select * into job from public.jobs j where j.id=selected_job;
 if not found then raise exception 'Posting not found' using errcode='P0002'; end if;
 if not coalesce((select enabled from private.knowledge_config where singleton),false) then raise exception 'Circle knowledge unavailable' using errcode='55000'; end if;
 select coalesce(jsonb_agg(item order by experience_date desc nulls last,created_at desc,id),'[]') into evidence from (
  select p.id,p.created_at,nullif(v.content->>'experienceDate','')::date experience_date,
   jsonb_build_object('id','report:circle_post:'||p.id,'kind','report','sourceType','circle_post','sourceId',p.id,'sourceRevision',p.published_revision,
    'title',v.content->>'title','insight',coalesce(nullif(v.content->>'insight',''),v.content->>'body',''),
    'company',v.content->>'company','role',v.content->>'role','stage',v.content->>'stage',
    'experienceDate',v.content->>'experienceDate','provenance',v.content->>'provenance','uncertainty',v.content->>'uncertainty',
    'source',jsonb_build_object('circleId',p.circle_id,'postId',p.id,'revision',p.published_revision,'path','/circles/?circle='||p.circle_id||'&thread='||p.id)) item
  from private.knowledge_posts p join private.knowledge_revisions v on v.post_id=p.id and v.revision=p.published_revision
  join private.circle_members m on m.circle_id=p.circle_id and m.user_id=actor and m.active
  where p.state='published' and p.parent_id is null
   and v.content->>'type' in ('discussion','interview_report','timeline','milestone')
   and coalesce(nullif(v.content->>'insight',''),nullif(v.content->>'body','')) is not null
   and (payload->>'since' is null or (v.content->>'experienceDate')::date>=(payload->>'since')::date)
   and (payload->>'until' is null or (v.content->>'experienceDate')::date<=(payload->>'until')::date)
   and exists(select 1 from jsonb_array_elements(jsonb_build_array(v.content)||coalesce(v.content->'contexts','[]'::jsonb)) context where
    ((context->>'jobUrl'=job.canonical_url) or (context->>'jobId'=job.id and private.company_key(context->>'company')=private.company_key(job.employer->>'company')))
    and (payload->>'stage' is null or private.company_key(coalesce(context->>'stage',v.content->>'stage'))=private.company_key(payload->>'stage')))
  order by experience_date desc nulls last,p.created_at desc,p.id limit lim
 ) reports;
 return jsonb_build_object('status',case when jsonb_array_length(evidence)=0 then 'no_discussions' else 'evidence_available' end,
  'automaticAction',case when jsonb_array_length(evidence)=0 then 'suppress' else 'assess_usefulness' end,
  'scope',jsonb_build_object('jobId',job.id,'company',job.employer->>'company','role',job.employer->>'title','stage',payload->>'stage','since',payload->>'since','until',payload->>'until','access','current_memberships','match','exact_posting'),
  'evidence',evidence,'coverage',jsonb_build_object('limit',lim,'possiblyMore',jsonb_array_length(evidence)=lim,'order','reported_date_desc'));
end $$;
revoke all on function private.interview_intelligence(uuid,jsonb) from public,anon,authenticated;

alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to interview_previous_knowledge_action;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if op='knowledge.interview' then return private.interview_intelligence(actor,payload); end if;
 return private.interview_previous_knowledge_action(actor,op,payload,connection);
end $$;
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.interview_previous_knowledge_action(uuid,text,jsonb,uuid) from public,anon,authenticated;

alter function public.agent_dispatch(text,text,jsonb) rename to interview_previous_agent_dispatch;
alter function public.interview_previous_agent_dispatch(text,text,jsonb) set schema private;
revoke all on function private.interview_previous_agent_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'knowledge.interview' then return private.interview_previous_agent_dispatch(credential_hash,operation,payload); end if;
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid credential' using errcode='28000'; end if;
 if not ('knowledge:read'=any(c.scopes)) or not ('workspace:read'=any(c.scopes)) then raise exception 'Knowledge and workspace read scopes required' using errcode='42501'; end if;
 return private.interview_intelligence(c.user_id,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
