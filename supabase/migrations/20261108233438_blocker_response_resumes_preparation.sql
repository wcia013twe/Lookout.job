begin;
-- A person's blocker answer resumes preparation. It cannot declare that Muse
-- has finished inspecting/filling the employer form or make a review card.
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.pronargs=1 and p.prosrc like '%Describe how the blocker was resolved%' and p.prosrc like '%to_jsonb(response=''accept'')%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one inline human decision writer';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$to_jsonb(response='accept')$old$,$new$to_jsonb(response='accept' and item->>'kind'<>'resolve_blocker')$new$);
 if changed=definition then raise exception 'Expected blocker readiness transition unavailable';end if;
 execute changed;
end $migration$;
notify pgrst,'reload schema';
commit;
