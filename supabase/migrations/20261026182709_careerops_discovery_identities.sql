begin;
-- Preserve existing historical rows. New observations keep functional ref/source
-- URL parameters, matching copied CareerOps postingUrlRelation behavior.
do $migration$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('private.search_owned(uuid,text,jsonb)'::regprocedure);
 changed:=replace(definition,'utm_[^=&#]+|gh_src|lever-source|ref|source','utm_[^=&#]+|gh_src|lever-source');
 if changed=definition then raise exception 'Expected canonical URL clause unavailable';end if;
 execute changed;
 -- Resume pages expose only stored public posting identity and requisition,
 -- enabling the copied scanner to retain strong native identities on retries.
 definition:=pg_get_functiondef('public.backend_worker(text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$'location',x->'location')$old$,$new$'location',x->'location','identity',x->>'identity','requisitionId',x->>'requisition_id')$new$);
 if changed=definition then raise exception 'Expected bounded identity projection unavailable';end if;
 execute changed;
end $migration$;
commit;
