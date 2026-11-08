begin;
-- Edge invokes the scoped dispatcher as service_role, never as the DB owner.
-- Preserve native identity/confirmation in the exact same browser/Muse projector.
create or replace function private.application_rounds_context(owner_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('applications',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'status',a.status,'company',j.employer->>'company','title',j.employer->>'title','location',j.employer->>'location','url',j.canonical_url,'milestones',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'round_id',m.round_id,'confirmation',m.confirmation,'kind',m.kind,'label',m.label,'phase',m.phase,'occurred_at',m.occurred_at,'supersedes_id',m.supersedes_id,'round',m.round) order by m.created_at,m.id),'[]') from public.application_milestones m where m.user_id=owner_id and m.application_id=a.id))),'[]') from public.applications a join public.jobs j on j.id=a.job_id where a.user_id=owner_id),
 'imports',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'record',i.record-array['notes'])),'[]') from public.imported_jobs i where i.user_id=owner_id));
$$;
revoke all on function private.application_rounds_context(uuid) from public,anon,authenticated;
grant execute on function private.application_rounds_context(uuid) to service_role;
commit;
