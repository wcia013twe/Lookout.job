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

-- Find the existing feed implementation rather than replacing outer domain
-- dispatchers introduced by other migrations. Keep its name, ACL and wrappers.
do $migration$
declare candidates oid[];definition text;changed text;
begin
 select array_agg(p.oid) into candidates from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('private','public') and p.pronargs=3
  and p.prosrc like '%Owned change events required%' and p.prosrc like '%changes.read%';
 if coalesce(cardinality(candidates),0)<>1 then raise exception 'Expected one Muse change-feed implementation';end if;
 definition:=pg_get_functiondef(candidates[1]);
 changed:=replace(definition,$old$'muse.profile_changed','muse.backend_job_finished'$old$,$new$'muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed'$new$);
 changed:=replace(changed,$old$'summary',e.payload->'text'$old$,$new$'summary',e.payload->'text','milestoneId',e.payload->'milestoneId','milestoneKind',e.payload->'milestoneKind','phase',e.payload->'phase','change',e.payload->'change','supersedesId',e.payload->'supersedesId'$new$);
 changed:=replace(changed,$old$  n:=coalesce((payload->>'limit')::integer,20);$old$,$new$  if payload ? 'limit' and (jsonb_typeof(payload->'limit')<>'number' or coalesce(payload->>'limit','') !~ '^[0-9]{1,2}$') then raise exception 'Integer limit required' using errcode='22023';end if;
  n:=coalesce((payload->>'limit')::integer,20);$new$);
 if changed=definition or strpos(changed,$marker$'milestoneId',e.payload->'milestoneId'$marker$)=0 or strpos(changed,'Integer limit required')=0 then raise exception 'Expected feed implementation unavailable';end if;
 execute changed;
end $migration$;
commit;
