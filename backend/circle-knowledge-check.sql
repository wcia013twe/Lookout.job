-- Run after production/staging migrations, before enabling the feature.
-- Read-only assertions; fixtures/two-account flows are documented in circle-knowledge.md.
begin;
do $$
declare tab text; sig regprocedure;
begin
 if (select enabled from private.knowledge_config where singleton) is distinct from false then raise exception 'Run this pre-enable check while the gate is disabled'; end if;
 foreach tab in array array['knowledge_config','circles','circle_members','circle_invites','knowledge_posts','knowledge_revisions','knowledge_approvals','knowledge_citations','knowledge_reports','knowledge_requests'] loop
  if not (select relrowsecurity from pg_class where oid=('private.'||tab)::regclass) then raise exception 'RLS missing on %',tab; end if;
  if has_table_privilege('anon','private.'||tab,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated','private.'||tab,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct table grant on %',tab; end if;
 end loop;
 if has_function_privilege('anon','public.knowledge_action(text,jsonb)','EXECUTE') or not has_function_privilege('authenticated','public.knowledge_action(text,jsonb)','EXECUTE') then raise exception 'Human API grants incorrect'; end if;
 if has_function_privilege('authenticated','public.agent_dispatch(text,text,jsonb)','EXECUTE') or has_function_privilege('anon','public.agent_dispatch(text,text,jsonb)','EXECUTE') or not has_function_privilege('service_role','public.agent_dispatch(text,text,jsonb)','EXECUTE') then raise exception 'Trusted gateway grants incorrect'; end if;
 foreach sig in array array['private.knowledge_action(uuid,text,jsonb,uuid)'::regprocedure,'private.validate_knowledge_content(jsonb)'::regprocedure,'private.knowledge_projection(private.knowledge_posts,uuid)'::regprocedure] loop
  if has_function_privilege('anon',sig,'EXECUTE') or has_function_privilege('authenticated',sig,'EXECUTE') then raise exception 'Private function grant on %',sig; end if;
 end loop;
end $$;
rollback;
