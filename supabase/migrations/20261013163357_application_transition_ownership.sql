revoke insert,update on public.applications from authenticated;
grant insert(user_id,job_id,draft,blocker) on public.applications to authenticated;
grant update(draft,blocker) on public.applications to authenticated;
create function private.initialize_application() returns trigger language plpgsql set search_path='' as $$ begin new.revision:=0; new.status:=case when nullif(new.blocker,'') is not null then 'Blocked' else 'Queued' end; return new; end $$;
create trigger initialize_application before insert on public.applications for each row execute function private.initialize_application();
