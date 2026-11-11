begin;

-- Screening is evaluated against the immutable context captured by the run.
do $migration$
declare definition text; changed text;
begin
 definition:=pg_get_functiondef('private.work_experience_dispatch_previous(text,text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$  perform 1 from private.agent_settings_versions where user_id=c.user_id for update;
  select coalesce(version,1) into v from private.agent_settings_versions where user_id=c.user_id;
  select version into pv from public.search_documents where user_id=c.user_id and kind='profile' and id=r.profile_id for update;
  if coalesce(v,1) is distinct from (payload->>'expectedPersonalVersion')::bigint or pv is distinct from (payload->>'expectedProfileVersion')::integer then raise exception 'Profile or settings changed' using errcode='40001';end if;$old$,$new$  v:=(r.context_snapshot->>'personalVersion')::bigint;
  select (x->>'version')::integer into pv from jsonb_array_elements(r.context_snapshot->'documents') x where x->>'kind'='profile' and x->>'id'=r.profile_id;
  if v is null or pv is null then raise exception 'Pinned search context unavailable' using errcode='22023';end if;
  if v is distinct from (payload->>'expectedPersonalVersion')::bigint or pv is distinct from (payload->>'expectedProfileVersion')::integer then raise exception 'Pinned search context mismatch' using errcode='PT409';end if;$new$);
 if changed=definition or position('Pinned search context mismatch' in changed)=0 then raise exception 'Expected search screening fence unavailable';end if;
 execute changed;
end $migration$;

-- The direct-search terminal receipt remains ownership/lease fenced, but profile
-- and personal-setting edits no longer invalidate a run already pinned at start.
do $migration$
declare definition text; changed text;
begin
 definition:=pg_get_functiondef('private.backend_worker_before_muse_requests(text,jsonb)'::regprocedure);
 changed:=replace(definition,$old$  perform 1 from private.agent_settings_versions where user_id=j.user_id for update;
  select coalesce((select version from private.agent_settings_versions where user_id=j.user_id),1) into v;
  select version into pv from public.search_documents where user_id=j.user_id and kind='profile' and id=j.input->>'profileId' for update;
  if v is distinct from (payload->'result'->'shortlist'->>'personalVersion')::bigint or pv is distinct from (payload->'result'->'shortlist'->>'evaluatedProfileVersion')::integer then raise exception 'Job settings changed before shortlist commit' using errcode='PT409';end if;$old$,$new$  select (r.context_snapshot->>'personalVersion')::bigint into v from public.search_runs r where r.user_id=j.user_id and r.id=j.search_run_id;
  select (x->>'version')::integer into pv from public.search_runs r cross join lateral jsonb_array_elements(r.context_snapshot->'documents') x where r.user_id=j.user_id and r.id=j.search_run_id and x->>'kind'='profile' and x->>'id'=r.profile_id;
  if v is null or pv is null then raise exception 'Pinned search context unavailable' using errcode='PT409';end if;
  if v is distinct from (payload->'result'->'shortlist'->>'personalVersion')::bigint or pv is distinct from (payload->'result'->'shortlist'->>'evaluatedProfileVersion')::integer then raise exception 'Pinned search context mismatch' using errcode='PT409';end if;$new$);
 if changed=definition or position('Pinned search context mismatch' in changed)=0 then raise exception 'Expected direct-search receipt fence unavailable';end if;
 execute changed;
end $migration$;

commit;
