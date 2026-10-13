create index applications_job_idx on public.applications(job_id);
create index batch_items_job_idx on public.batch_items(job_id);
create policy agents_no_client on private.agent_connections for all to authenticated using(false) with check(false);
