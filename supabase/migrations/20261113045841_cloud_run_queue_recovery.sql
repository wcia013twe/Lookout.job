create function public.backend_worker_pending() returns boolean
language sql security definer set search_path='' as $$
 select exists(select 1 from private.backend_jobs
  where kind='search_ats' and (status='queued' or (status='running' and lease_expires_at<=now())))
$$;
revoke all on function public.backend_worker_pending() from public,anon,authenticated;
grant execute on function public.backend_worker_pending() to service_role;
