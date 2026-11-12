do $$
declare definition text; changed text;
begin
 definition:=pg_get_functiondef('private.company_previous_knowledge_action(uuid,text,jsonb,uuid)'::regprocedure);
 changed:=replace(definition,
  'exists(select 1 from private.knowledge_posts parent where parent.id=source_post.parent_id and parent.state=''published'')',
  'exists(select 1 from private.knowledge_posts citation_parent where citation_parent.id=source_post.parent_id and citation_parent.state=''published'')');
 if changed=definition then raise exception 'Reply citation availability migration target not found'; end if;
 execute changed;
end $$;
