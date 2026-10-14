begin;
-- Exposed PostgREST functions are invokers; privileged bodies live in the
-- unexposed private schema and always derive the signed-in owner from auth.uid().
alter function public.read_quiet_mode() set schema private;
alter function private.read_quiet_mode() rename to read_quiet_mode_authenticated;
alter function public.save_quiet_mode(jsonb,bigint) set schema private;
alter function private.save_quiet_mode(jsonb,bigint) rename to save_quiet_mode_authenticated;
alter function public.reconsider_selection(uuid,text) set schema private;
alter function private.reconsider_selection(uuid,text) rename to reconsider_selection_authenticated;
alter function public.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) set schema private;
alter function private.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) rename to save_preferences_authenticated;
revoke all on function private.read_quiet_mode_authenticated(),private.save_quiet_mode_authenticated(jsonb,bigint),private.reconsider_selection_authenticated(uuid,text),private.save_preferences_authenticated(jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.read_quiet_mode_authenticated(),private.save_quiet_mode_authenticated(jsonb,bigint),private.reconsider_selection_authenticated(uuid,text),private.save_preferences_authenticated(jsonb,jsonb,text,jsonb) to authenticated;

create function public.read_quiet_mode() returns jsonb
language sql security invoker set search_path='' as $$ select private.read_quiet_mode_authenticated() $$;
create function public.save_quiet_mode(next_settings jsonb,expected_version bigint) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_quiet_mode_authenticated(next_settings,expected_version) $$;
create function public.reconsider_selection(decision_id uuid,expected_at text) returns public.selection_decisions
language sql security invoker set search_path='' as $$ select private.reconsider_selection_authenticated(decision_id,expected_at) $$;
create function public.save_preferences_preserving_quiet(search_next jsonb,lists_next jsonb,active_next text,theme_next jsonb) returns public.preferences
language sql security invoker set search_path='' as $$ select private.save_preferences_authenticated(search_next,lists_next,active_next,theme_next) $$;
revoke all on function public.read_quiet_mode(),public.save_quiet_mode(jsonb,bigint),public.reconsider_selection(uuid,text),public.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) from public,anon;
grant execute on function public.read_quiet_mode(),public.save_quiet_mode(jsonb,bigint),public.reconsider_selection(uuid,text),public.save_preferences_preserving_quiet(jsonb,jsonb,text,jsonb) to authenticated;
commit;
