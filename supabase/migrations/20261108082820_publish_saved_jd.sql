begin;
-- Publication copies the latest owned source observation, never agent prose.
-- Existing catalog jobs remain immutable. Missing captures render the existing
-- "Full description not collected" state rather than a fabricated quotation.
do $install$
declare definition text; body text; original text; replacement text;
begin
 select pg_get_functiondef(p.oid),p.prosrc into definition,body
 from pg_proc p where p.oid='private.agent_dispatch_core(text,text,jsonb)'::regprocedure;
 original:=$old$values(v_job_id,job->>'canonicalUrl',job->'employer') on conflict(canonical_url) do nothing;$old$;
 replacement:=$new$values(v_job_id,job->>'canonicalUrl',jsonb_set(job->'employer','{description}',to_jsonb(coalesce((
   select o.description from public.search_observations o
   join public.search_listings l on l.id=o.listing_id and l.user_id=o.user_id
   where o.user_id=c.user_id and l.canonical_url=job->>'canonicalUrl'
   order by o.checked_at desc,o.created_at desc,o.id desc limit 1
 ),'')))) on conflict(canonical_url) do nothing;$new$;
 if position(original in body)=0 then raise exception 'Publication JD insertion hook not found';end if;
 execute replace(definition,body,replace(body,original,replacement));
end $install$;
commit;
