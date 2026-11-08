begin;
-- Valid official multi-location postings can exceed the old 500-character
-- location field limit. Preserve the full text under a still-bounded contract.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('private.search_owned(uuid,text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$length(coalesce(x->>'location',''))>500$old$,$new$length(coalesce(x->>'location',''))>2000$new$);
 if changed=definition then raise exception 'Expected discovery location bound unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
