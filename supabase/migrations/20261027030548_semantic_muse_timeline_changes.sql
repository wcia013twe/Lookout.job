begin;
-- Reuse the existing system pointer events and per-connection receipts.
drop index public.muse_changes_pending;
create index muse_changes_pending on public.activity_events(user_id,occurred_at,id)
 where actor='system' and kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed');

create function private.emit_muse_timeline_change() returns trigger language plpgsql security definer set search_path='' as $$
declare app public.applications;extra jsonb;key text;stamp jsonb;
begin
 if tg_table_name='application_milestones' then
  select * into app from public.applications where id=new.application_id and user_id=new.user_id;
  if not found then return new;end if;
  key:='milestone:'||new.id;stamp:=to_jsonb(new.created_at);
  extra:=jsonb_build_object('change',case when new.supersedes_id is null then 'milestone_added' else 'milestone_replaced' end,'milestoneId',new.id,'supersedesId',new.supersedes_id,'milestoneKind',new.kind,'phase',new.phase);
 else
  if new.status is not distinct from old.status or not (new.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') or old.status in ('Submitted','Interview','Offer','Rejected','Withdrawn')) then return new;end if;
  app:=new;key:='stage:'||new.id||':'||gen_random_uuid();stamp:=to_jsonb(new.revision);
  extra:=jsonb_build_object('change','stage_changed','status',new.status);
 end if;
 insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
 values(app.user_id,app.id,'muse-feed:timeline:'||key,'muse.application_timeline_changed','system',extra||jsonb_build_object(
  'entity','application_timeline','recordId',app.id,'jobId',app.job_id,'version',stamp,
  'text','Application timeline changed. Read the current timeline.')) on conflict(user_id,event_key) do nothing;
 return new;
end $$;
revoke all on function private.emit_muse_timeline_change() from public,anon,authenticated;
create trigger muse_timeline_milestone after insert on public.application_milestones for each row execute function private.emit_muse_timeline_change();
create trigger muse_timeline_stage after update of status on public.applications for each row execute function private.emit_muse_timeline_change();

-- Update the existing inner feed dispatcher, preserving the newer outer
-- interview-reporting source/ownership validation.
create or replace function private.interview_reporting_dispatch_previous(credential_hash text,operation text,payload jsonb) returns jsonb
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
  if payload ? 'limit' and (jsonb_typeof(payload->'limit')<>'number' or coalesce(payload->>'limit','') !~ '^[0-9]{1,2}$') then raise exception 'Integer limit required' using errcode='22023';end if;
  n:=coalesce((payload->>'limit')::integer,20);if n not between 1 and 50 then raise exception 'Bounded limit required' using errcode='22023';end if;
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id',e.id,'kind',replace(e.kind,'muse.',''),'occurredAt',e.occurred_at,'entity',e.payload->'entity','recordId',e.payload->'recordId','version',e.payload->'version','jobId',e.payload->'jobId','fieldIds',e.payload->'fieldIds','status',e.payload->'status','runId',e.payload->'runId','summary',e.payload->'text','milestoneId',e.payload->'milestoneId','milestoneKind',e.payload->'milestoneKind','phase',e.payload->'phase','change',e.payload->'change','supersedesId',e.payload->'supersedesId')) order by e.occurred_at,e.id),'[]') into items
  from (select * from public.activity_events e where e.user_id=c.user_id and e.actor='system' and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed')
   and not exists(select 1 from private.muse_change_receipts r where r.connection_id=c.id and r.event_id=e.id) order by e.occurred_at,e.id limit n+1) e;
  return jsonb_build_object('items',(select coalesce(jsonb_agg(x.value order by x.ordinality),'[]') from jsonb_array_elements(items) with ordinality x where x.ordinality<=n),'hasMore',jsonb_array_length(items)>n,'limit',n);
 end if;
 if exists(select 1 from jsonb_object_keys(payload) k where k<>'eventIds') or jsonb_typeof(payload->'eventIds') is distinct from 'array' or jsonb_array_length(payload->'eventIds') not between 1 and 50
  or exists(select 1 from jsonb_array_elements(payload->'eventIds') x where jsonb_typeof(x)<>'string') then raise exception 'Bounded event IDs required' using errcode='22023';end if;
 ids:=array(select x::uuid from jsonb_array_elements_text(payload->'eventIds') x);
 if cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Unique IDs required' using errcode='22023';end if;
 if exists(select 1 from unnest(ids) x where not exists(select 1 from public.activity_events e where e.id=x and e.user_id=c.user_id and e.actor='system' and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed'))) then raise exception 'Owned change events required' using errcode='42501';end if;
 insert into private.muse_change_receipts(connection_id,event_id) select c.id,x from unnest(ids) x on conflict do nothing;
 -- Bounded housekeeping: only these system pointer events, older than 30 days,
 -- handled by every active full-workspace consumer. Never discard pending work.
 delete from public.activity_events e where e.id in (
  select e.id from public.activity_events e where e.user_id=c.user_id and e.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed') and e.actor='system' and e.occurred_at<now()-interval '30 days'
  and not exists(select 1 from private.agent_connections ac where ac.user_id=c.user_id and ac.revoked_at is null and ac.expires_at>now() and array['workspace:read','activity:write']::text[]<@ac.scopes and not exists(select 1 from private.muse_change_receipts r where r.connection_id=ac.id and r.event_id=e.id))
  order by e.occurred_at,e.id limit 100);
 return jsonb_build_object('acknowledgedIds',to_jsonb(ids));
end $$;
commit;
