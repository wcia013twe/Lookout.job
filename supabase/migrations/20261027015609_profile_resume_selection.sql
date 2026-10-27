-- Include the current owned profile in submission authorization and claim/start comparisons.
create or replace function private.submission_context(owner_id uuid, app_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select jsonb_build_object('application',to_jsonb(a),'job',to_jsonb(j),
    'profile',(select to_jsonb(p) from public.profiles p where p.user_id=owner_id),
    'searchProfile',(select d.projection||jsonb_build_object('id',d.id,'version',d.version) from public.search_documents d where d.user_id=owner_id and d.kind='profile' and d.id=a.draft->>'searchProfileId'),
    'preferences',(select to_jsonb(p) from public.preferences p where p.user_id=owner_id),
    'resume',(select to_jsonb(r) from public.resumes r where r.user_id=owner_id and r.id::text=a.draft->>'resumeId'),
    'resumes',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.resumes r where r.user_id=owner_id),
    'answers',(select coalesce(jsonb_agg(to_jsonb(b) order by b.id),'[]') from public.answer_library b where b.user_id=owner_id),
    'approval',case when a.status='Approved' then (select to_jsonb(p) from public.approvals p where p.user_id=owner_id and p.application_id=a.id and p.revision=a.revision) else null end,
    'personalVersion',coalesce((select v.version from private.agent_settings_versions v where v.user_id=owner_id),1))
  from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id and a.id=app_id;
$$;
revoke all on function private.submission_context(uuid,uuid) from public,anon,authenticated;
grant execute on function private.submission_context(uuid,uuid) to service_role;

