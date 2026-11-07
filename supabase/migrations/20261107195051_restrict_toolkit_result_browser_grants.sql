begin;
-- Hosted public-schema defaults grant ALL to browser roles. RLS protects row
-- access but does not protect TRUNCATE. This table is written only by its fixed
-- server functions; browsers retain the existing owner-scoped SELECT policy.
revoke all on public.career_toolkit_results from public,anon,authenticated;
grant select on public.career_toolkit_results to authenticated;
grant all on public.career_toolkit_results to service_role;
commit;
