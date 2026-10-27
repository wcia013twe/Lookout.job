begin;
-- Existing activity rows are the events; only per-connection acknowledgements
-- need new storage. No answer values, profile bodies or job results are copied.
create table private.muse_change_receipts (
 connection_id uuid not null references private.agent_connections(id) on delete cascade,
 event_id uuid not null references public.activity_events(id) on delete cascade,
 acknowledged_at timestamptz not null default now(),primary key(connection_id,event_id)
);
alter table private.muse_change_receipts enable row level security;
revoke all on private.muse_change_receipts from public,anon,authenticated;
grant all on private.muse_change_receipts to service_role;
create index muse_changes_pending on public.activity_events(user_id,occurred_at,id)
 where actor='system' and kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished');

create function private.guard_muse_activity() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.kind like 'muse.%' or new.event_key like 'muse-feed:%') and new.actor<>'system' then
  raise exception 'Reserved system change event' using errcode='42501';
 end if;return new;
end $$;
revoke all on function private.guard_muse_activity() from public,anon,authenticated;
create trigger guard_muse_activity before insert on public.activity_events for each row execute function private.guard_muse_activity();

create function private.emit_muse_change() returns trigger language plpgsql security definer set search_path='' as $$
declare k text;key text;p jsonb;app uuid;marker jsonb;owner_id uuid;summary text;
begin
 owner_id:=new.user_id;
 if tg_table_name='applications' then
  marker:=new.draft->'lastAnswerConfirmation';
  if auth.uid() is distinct from owner_id or marker is not distinct from old.draft->'lastAnswerConfirmation' or jsonb_typeof(marker) is distinct from 'object' then return new;end if;
  if (select count(*) from jsonb_object_keys(marker))<>2 or coalesce(marker->>'id','') !~ '^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$' or length(coalesce(marker->>'fieldId','')) not between 1 and 200
   or not exists(select 1 from jsonb_array_elements(coalesce(new.draft->'questions','[]')) q where coalesce(q->>'fieldId',q->>'id')=marker->>'fieldId' and nullif(trim(q->>'answer'),'') is not null)
   then raise exception 'Confirmation must reference a saved nonempty answer' using errcode='22023';end if;
  k:='muse.answer_confirmed';key:='answer:'||new.id||':'||(marker->>'id');app:=new.id;
  p:=jsonb_build_object('entity','application','recordId',new.id,'version',new.revision,'jobId',new.job_id,'fieldIds',jsonb_build_array(marker->>'fieldId'));
  summary:='Answer confirmed. Re-read the current draft and continue preparation.';
 elsif tg_table_name='preferences' then
  if (new.search-'profiles') is not distinct from (old.search-'profiles') and new.tier_lists is not distinct from old.tier_lists and new.active_tier_list_id is not distinct from old.active_tier_list_id then return new;end if;
  k:='muse.preferences_changed';key:='preferences:'||owner_id||':'||new.updated_at;
  p:=jsonb_build_object('entity','preferences','recordId',owner_id,'version',new.updated_at);
  summary:='Job preferences changed. Reload settings before continuing.';
 elsif tg_table_name='search_documents' then
  if new.kind<>'profile' or (tg_op='UPDATE' and new.version=old.version) then return new;end if;
  k:='muse.profile_changed';key:='profile:'||owner_id||':'||new.id||':'||new.version;
  p:=jsonb_build_object('entity','search_profile','recordId',new.id,'version',new.version);
  summary:='Search profile changed. Re-read this profile before continuing.';
 elsif tg_table_name='backend_jobs' then
  if new.status not in ('completed','partial','failed','cancelled') or new.status=old.status then return new;end if;
  k:='muse.backend_job_finished';key:='backend:'||new.id||':'||new.version;
  p:=jsonb_build_object('entity','backend_job','recordId',new.id,'version',new.version,'status',new.status,'runId',new.search_run_id);
  summary:='Backend job finished. Read its saved result and blockers.';
 end if;
 if k is not null then
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
   values(owner_id,app,'muse-feed:'||key,k,'system',p||jsonb_build_object('text',summary)) on conflict(user_id,event_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.emit_muse_change() from public,anon,authenticated;
create trigger muse_answer_confirmed after update of draft on public.applications for each row execute function private.emit_muse_change();
create trigger muse_preferences_changed after update on public.preferences for each row execute function private.emit_muse_change();
create trigger muse_profile_changed after insert or update on public.search_documents for each row execute function private.emit_muse_change();
create trigger muse_backend_job_finished after update of status on private.backend_jobs for each row execute function private.emit_muse_change();

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_muse_changes;
alter function public.agent_dispatch_before_muse_changes(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_muse_changes(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;n integer;items jsonb;ids uuid[];key text;
begin
 if operation not in ('changes.read','changes.ack') then return private.agent_dispatch_before_muse_changes(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_before_muse_changes(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not ('workspace:read'=any(c.scopes)) or (operation='changes.ack' and not ('activity:write'=any(c.scopes))) then raise exception 'Change feed scope required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'Object required' using errcode='22023';end if;
 if operation='changes.read' then
  if exists(select 1 from jsonb_object_keys(payload) k where k<>'limit') then raise exception 'Unknown change feed argument' using errcode='22023';end if;
  n:=coalesce((payload->>'limit')::integer,20);if n not between 1 and 50 then raise exception 'Bounded limit required' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',e.id,'kind',replace(e.kind,'muse.',''),'occurredAt',e.occurred_at,'entity',e.payload->'entity','recordId',e.payload->'recordId','version',e.payload->'version','jobId',e.payload->'jobId','fieldIds',e.payload->'fieldIds','status',e.payload->'status','runId',e.payload->'runId','summary',e.payload->'text')) order by e.occurred_at,e.id),'[]') into items
  from (select * from public.activity_events e where e.user_id=c.user_id and e.actor='system' and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished')
   and not exists(select 1 from private.muse_change_receipts r where r.connection_id=c.id and r.event_id=e.id) order by e.occurred_at,e.id limit n+1) e;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(x.value order by x.ordinality),'[]') from jsonb_array_elements(items) with ordinality x where x.ordinality<=n),'hasMore',jsonb_array_length(items)>n,'limit',n);
 end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k<>'eventIds') or jsonb_typeof(payload->'eventIds') is distinct from 'array' or jsonb_array_length(payload->'eventIds') not between 1 and 50
  or exists(select 1 from jsonb_array_elements(payload->'eventIds') x where jsonb_typeof(x)<>'string') then raise exception 'Bounded event IDs required' using errcode='22023';end if;
 ids:=array(select x::uuid from jsonb_array_elements_text(payload->'eventIds') x);
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Unique IDs required' using errcode='22023';end if;
 if exists(select 1 from unnest(ids) x where not exists(select 1 from public.activity_events e where e.id=x and e.user_id=c.user_id and e.actor='system' and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished'))) then raise exception 'Owned change events required' using errcode='42501';end if;
 insert into private.muse_change_receipts(connection_id,event_id) select c.id,x from unnest(ids) x on conflict do nothing;
 -- Bounded housekeeping: only these system pointer events, older than 30 days,
 -- handled by every active full-workspace consumer. Never discard pending work.
 delete from public.activity_events e where e.id in (
  select e.id from public.activity_events e where e.user_id=c.user_id and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished') and e.actor='system' and e.occurred_at<now()-interval '30 days'
  and not exists(select 1 from private.agent_connections ac where ac.user_id=c.user_id and ac.revoked_at is null and ac.expires_at>now() and array['workspace:read','activity:write']::text[]<@ac.scopes and not exists(select 1 from private.muse_change_receipts r where r.connection_id=ac.id and r.event_id=e.id))
  order by e.occurred_at,e.id limit 100);
 return jsonb_build_object('acknowledgedIds',to_jsonb(ids));
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
