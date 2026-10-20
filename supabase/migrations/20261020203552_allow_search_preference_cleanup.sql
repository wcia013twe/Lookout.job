-- BEFORE DELETE must return OLD for trusted cleanup as well as client deletes.
-- Returning NEW (NULL on DELETE) silently cancels FK cascades from auth.users.
create or replace function private.guard_search_projections() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if tg_op='DELETE' then
   if exists(select 1 from public.search_documents where user_id=old.user_id) then raise exception 'Use canonical context operations' using errcode='42501';end if;
   return old;
  elsif tg_op='INSERT' then
   if new.search ?| array['profiles','targets','targetsVersion'] then raise exception 'Use canonical context operations' using errcode='42501';end if;
  elsif (new.search->'profiles') is distinct from (old.search->'profiles') or (new.search->'targets') is distinct from (old.search->'targets') or (new.search->'targetsVersion') is distinct from (old.search->'targetsVersion') then
   raise exception 'Use canonical context operations' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;
 return new;
end $$;
revoke all on function private.guard_search_projections() from public,anon,authenticated;
