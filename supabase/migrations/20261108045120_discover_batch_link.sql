-- Fix only the returned Discover batch locator after the existing Pages rename.
-- The authenticated dispatch function, records, scopes and grants are unchanged.
do $$
declare definition text; old_url constant text := 'https://wcia013twe.github.io/codex-automated-job-board/?batch=';
begin
 select pg_get_functiondef('private.agent_dispatch_core(text,text,jsonb)'::regprocedure) into definition;
 if strpos(definition, old_url) = 0 then raise exception 'Expected Discover batch link was not found'; end if;
 execute replace(definition, old_url, 'https://wcia013twe.github.io/Lookout.job/?batch=');
end $$;
