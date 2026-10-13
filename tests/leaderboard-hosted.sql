-- Run in the hosted SQL editor or execute_sql. Synthetic rows never survive rollback.
begin;
insert into auth.users(id) values('99999999-1111-4111-8111-111111111111'),('99999999-2222-4222-8222-222222222222');
insert into public.jobs(id,canonical_url,employer) values('leaderboard-check-a','https://example.invalid/leaderboard-check-a','{}'),('leaderboard-check-b','https://example.invalid/leaderboard-check-b','{}');
insert into public.applications(user_id,job_id,created_at,submitted_at) values
('99999999-1111-4111-8111-111111111111','leaderboard-check-a',now()-interval '1 day',now()),
('99999999-1111-4111-8111-111111111111','leaderboard-check-b',now()-interval '1 day',null);
insert into public.approvals(user_id,application_id,revision,snapshot)
select user_id,id,0,'{}' from public.applications where job_id='leaderboard-check-a';
insert into public.approvals(user_id,application_id,revision,snapshot)
select user_id,id,1,'{}' from public.applications where job_id='leaderboard-check-a';
set local role authenticated;
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
do $$ declare entry public.leaderboard_entries; begin
  select * into entry from public.refresh_leaderboard();
  if entry.xp <> 35 or entry.streak <> 2 or entry.applications_count <> 1 or entry.opted_in then raise exception 'Metric mismatch'; end if;
  select * into entry from public.refresh_leaderboard();
  if entry.xp <> 35 then raise exception 'Duplicate refresh inflated score'; end if;
  if has_column_privilege('authenticated','public.leaderboard_entries','xp','UPDATE') then raise exception 'Score mutable'; end if;
  if has_column_privilege('authenticated','public.leaderboard_entries','user_id','SELECT') then raise exception 'Identity exposed'; end if;
end $$;
select set_config('request.jwt.claim.sub','99999999-2222-4222-8222-222222222222',true);
do $$ declare entry public.leaderboard_entries; begin
  if exists(select 1 from public.leaderboard_entries where alias='Player') then raise exception 'Private entry exposed'; end if;
  select * into entry from public.refresh_leaderboard();
  if entry.xp <> 0 or entry.user_id <> auth.uid() then raise exception 'Owner isolation failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
select public.set_leaderboard_preferences('Leaderboard test owner',true);
select set_config('request.jwt.claim.sub','99999999-2222-4222-8222-222222222222',true);
do $$ begin
  if not exists(select 1 from public.leaderboard_entries where opted_in and alias='Leaderboard test owner' and xp=35) then raise exception 'Opt-in missing'; end if;
end $$;
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
select public.set_leaderboard_preferences('Leaderboard test owner',false);
select set_config('request.jwt.claim.sub','99999999-2222-4222-8222-222222222222',true);
do $$ begin
  if exists(select 1 from public.leaderboard_entries where alias='Leaderboard test owner') then raise exception 'Opt-out failed'; end if;
end $$;
rollback;
