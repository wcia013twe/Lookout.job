-- Public projection contains aliases and counts only; identity stays private.
revoke select,insert,update on public.leaderboard_entries from authenticated;
revoke update(alias,opted_in) on public.leaderboard_entries from authenticated;
grant select(alias,opted_in,xp,streak,applications_count) on public.leaderboard_entries to authenticated;

-- The definer is needed only to write protected derived metrics. Never accepts an owner or score.
create function private.refresh_leaderboard(p_alias text default null, p_opted_in boolean default null)
returns public.leaderboard_entries language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid(); result public.leaderboard_entries; points bigint; total integer; days integer;
begin
  if owner is null then raise exception 'Sign in required'; end if;
  if p_alias is not null and length(trim(p_alias)) not between 1 and 40 then
    raise exception 'Use an alias between 1 and 40 characters';
  end if;
  -- Multiple approvals/retries count once per application, regardless of revision.
  select coalesce(sum(5 + case when exists(select 1 from public.approvals r where r.user_id=owner and r.application_id=a.id) then 10 else 0 end
    + case when a.submitted_at is not null then 15 else 0 end),0),
    count(*) filter(where a.submitted_at is not null)::integer
    into points,total from public.applications a where a.user_id=owner;
  -- UTC calendar-day streak ending today or yesterday; draft edits and arbitrary events do not count.
  with active_days as (
    select (created_at at time zone 'UTC')::date as active_day from public.applications where user_id=owner
    union select (approved_at at time zone 'UTC')::date from public.approvals where user_id=owner
    union select (submitted_at at time zone 'UTC')::date from public.applications where user_id=owner and submitted_at is not null
  ), ordered as (
    select active_day,row_number() over(order by active_day desc)::integer n from active_days
    where active_day <= (now() at time zone 'UTC')::date
  ), consecutive as (
    select active_day,n,max(active_day) over() latest from ordered
  ) select count(*)::integer into days from consecutive
    where latest >= (now() at time zone 'UTC')::date - 1 and active_day = latest - (n-1);
  insert into public.leaderboard_entries(user_id,alias,opted_in,xp,streak,applications_count)
    values(owner,coalesce(trim(p_alias),'Player'),coalesce(p_opted_in,false),points,days,total)
    on conflict(user_id) do update set alias=coalesce(trim(p_alias),leaderboard_entries.alias),
      opted_in=coalesce(p_opted_in,leaderboard_entries.opted_in),xp=excluded.xp,streak=excluded.streak,
      applications_count=excluded.applications_count,updated_at=now()
    returning * into result;
  return result;
end $$;
revoke all on function private.refresh_leaderboard(text,boolean) from public,anon;
grant execute on function private.refresh_leaderboard(text,boolean) to authenticated;
create function public.refresh_leaderboard() returns public.leaderboard_entries
language sql security invoker set search_path = '' as $$ select private.refresh_leaderboard(); $$;
create function public.set_leaderboard_preferences(alias text,opted_in boolean) returns public.leaderboard_entries
language sql security invoker set search_path = '' as $$ select private.refresh_leaderboard(alias,opted_in); $$;
revoke all on function public.refresh_leaderboard(),public.set_leaderboard_preferences(text,boolean) from public,anon;
grant execute on function public.refresh_leaderboard(),public.set_leaderboard_preferences(text,boolean) to authenticated;
