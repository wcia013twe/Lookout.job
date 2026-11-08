begin;
-- Extend the shared owned read projection, retaining inbox handoffs as authority.
-- These rows link to existing editors; they cannot manufacture approval or submission.
alter function private.action_board_items(uuid) rename to action_board_items_before_application_actions;
create function private.action_board_items(owner_id uuid) returns setof jsonb
language sql stable security definer set search_path='' as $$
 select item from (
  select x as item from private.action_board_items_before_application_actions(owner_id) x
  union all
  select jsonb_build_object(
   'key','application:'||a.id||':'||a.revision||':'||a.status,
   'kind',case when a.status='Approved' then 'submit_application' else 'prepared_application' end,
   'sourceId',a.id,'applicationId',a.id,'version',a.revision::text,'createdAt',a.updated_at,
   'company',j.employer->>'company','role',j.employer->>'title',
   'reason',case when a.status='Approved' then 'This application is approved and still needs submission. Open it to continue through the existing submission flow.' else 'This saved draft has application content. Open it to complete review and resolve any missing information.' end,
   'href','/applications/?application='||a.id||'&tab=Documents',
   'requiresReview',false,'reviewed',false,'canAccept',false,'canReject',false)
  from public.applications a join public.jobs j on j.id=a.job_id
  where a.user_id=owner_id and not private.work_is_stopped(owner_id,a.id)
   and (a.status='Approved' or (a.status='Draft' and (
    nullif(trim(a.draft->>'resumeId'),'') is not null
    or nullif(trim(a.draft->>'coverLetter'),'') is not null
    or exists(select 1 from jsonb_array_elements(coalesce(a.draft->'questions','[]')) q where nullif(trim(q->>'answer'),'') is not null))))
   -- Include delayed uncertainty too: never suggest another submission during it.
   and not exists(select 1 from public.action_inbox i where i.user_id=owner_id and i.application_id=a.id and i.resolved_at is null)
   and not exists(select 1 from public.submission_attempts t where t.user_id=owner_id and t.application_id=a.id and t.state in ('claimed','started','uncertain','confirmed'))
  union all
  select jsonb_build_object(
   'key','imported:'||i.id||':'||md5(i.record::text),'kind','imported_action',
   'sourceId',i.id,'version',md5(i.record::text),'createdAt',i.created_at,
   'company',i.record->>'company','role',i.record->>'title','status',i.record->>'status',
   'employmentType',i.record->>'employmentType','appliedDate',i.record->>'appliedDate',
   'reason',i.record->>'nextAction','actionDate',i.record->>'actionDate',
   'href','/applications/?application=import:'||i.id||'&tab=Overview',
   'requiresReview',false,'reviewed',false,'canAccept',false,'canReject',false)
  from public.imported_jobs i where i.user_id=owner_id
   and i.record->'needsAction'='true'::jsonb and nullif(trim(i.record->>'nextAction'),'') is not null
   and coalesce(i.record->'archived','false'::jsonb)<>'true'::jsonb
   and coalesce(i.record->>'status','') not in ('REJECTED','WITHDRAWN','CLOSED')
 ) rows order by (item->>'createdAt')::timestamptz,item->>'key'
$$;
revoke all on function private.action_board_items(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
