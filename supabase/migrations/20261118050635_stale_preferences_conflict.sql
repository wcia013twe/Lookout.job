-- A stale preferences version requires a fresh read before the caller retries.
do $migration$
declare
  target regprocedure;
  definition text;
  previous_check constant text := $old$raise exception 'Preferences changed' using errcode='40001'$old$;
  replacement_check constant text := $new$raise exception 'Preferences changed' using errcode='PT409'$new$;
begin
  foreach target in array array[
    'private.platform_actions_for_owner(uuid,text,jsonb)'::regprocedure,
    'private.configure_card_pack_preferences(uuid,text,jsonb)'::regprocedure
  ] loop
    definition := pg_get_functiondef(target);
    if length(definition) - length(replace(definition, previous_check, '')) <> length(previous_check) then
      raise exception 'Expected exactly one stale preferences check in %', target;
    end if;
    execute replace(definition, previous_check, replacement_check);
  end loop;
end
$migration$;
