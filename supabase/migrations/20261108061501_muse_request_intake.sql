-- Muse intake must not depend on deterministic browser adapter support.
-- Keep URL shape validation; submission_platform remains unchanged for receipts.
do $migration$
declare definition text; updated text;
begin
 definition:=pg_get_functiondef('private.queue_application_before_board(uuid,uuid,jsonb)'::regprocedure);
 updated:=replace(definition,
  $old$or private.submission_platform(p->>'url') is null$old$,
  $new$-- or private.submission_platform(p->>'url') is null
  or coalesce(p->>'url','') !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]+(/[^[:space:]]*)?$'$new$);
 -- Older local stacks may still contain the original Greenhouse-only gate.
 if updated=definition then
  updated:=replace(definition,
   $old$or coalesce(p->>'url','') !~ '^https://(job-boards|boards)\.greenhouse\.io/[a-zA-Z0-9_-]+/jobs/[0-9]+$'$old$,
   $new$-- Deterministic Greenhouse-only provider restriction disabled for Muse.
  or coalesce(p->>'url','') !~ '^https://[a-zA-Z0-9][a-zA-Z0-9.-]+(/[^[:space:]]*)?$'$new$);
 end if;
 if updated=definition then raise exception 'Expected application request validation not found';end if;
 execute updated;
end $migration$;
