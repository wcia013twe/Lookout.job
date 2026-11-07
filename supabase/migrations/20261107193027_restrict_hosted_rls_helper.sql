begin;
-- Hosted projects may install this platform event trigger outside app migrations.
-- DDL still invokes it as before; browser roles do not need direct RPC access.
-- Leave projects without the platform helper unchanged.
do $migration$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  revoke all on function public.rls_auto_enable() from public,anon,authenticated;
 end if;
end $migration$;
commit;
