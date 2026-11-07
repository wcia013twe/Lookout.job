begin;
-- Refresh private verified source facts when an existing posting changes.
-- Shared published jobs and application records remain untouched.
do $$
declare definition text;changed text;
begin
 definition:=pg_get_functiondef('private.search_owned(uuid,text,jsonb)'::regprocedure);
 changed:=replace(definition,'set last_seen=now(),location=', 'set last_seen=now(),company=x->>''company'',title=x->>''title'',employment_type=coalesce(x->>''employmentType'',employment_type),location=');
 if changed=definition then raise exception 'Expected private listing update unavailable';end if;
 execute changed;
end $$;
commit;
