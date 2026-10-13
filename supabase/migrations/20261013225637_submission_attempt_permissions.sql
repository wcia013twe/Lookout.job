-- Override Supabase's default table grants explicitly; RLS allows owner reads only.
revoke all on table public.submission_attempts from public,anon,authenticated;
grant select on table public.submission_attempts to authenticated;
grant all on table public.submission_attempts to service_role;
