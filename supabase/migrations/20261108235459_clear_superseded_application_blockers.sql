-- Status reporting supersedes preparation blockers, not unresolved submission evidence.
-- Keep this in the shared row transition used by human set_application_stage,
-- agent record_application_progress and runner-confirmed outcomes.
create or replace function private.version_application() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.draft is distinct from old.draft or new.blocker is distinct from old.blocker then
    if old.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then
      raise exception 'Tracked application draft cannot be edited';
    end if;
    new.revision := old.revision + 1;
    new.status := case when nullif(new.blocker,'') is not null then 'Blocked'
      when new.draft->>'questionsReviewed' = 'true' then 'Awaiting approval' else 'Draft' end;
  else
    new.revision := old.revision;
    -- Only a status-only write can retire a preparation blocker. Do not turn a
    -- progress report into draft editing, approval, or uncertainty resolution.
    if new.status in ('Submitted','Interview','Offer','Rejected','Withdrawn')
      and new.blocker is not null
      and not exists(select 1 from public.submission_attempts
        where application_id=old.id and state in ('claimed','started','uncertain')) then
      new.blocker := null;
    end if;
  end if;
  new.updated_at := now(); return new;
end $$;

-- A retired blocker is not a draft revision and must not log a misleading
-- "previous approval no longer applies" event or reuse a draft revision key.
create or replace function private.log_application_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_kind text; event_text text; key text; event_actor text;
begin
  event_actor := case when auth.uid() = new.user_id then 'user' else 'agent' end;
  if TG_OP = 'INSERT' then
    event_kind := 'application_queued'; event_text := 'Application queued';
    key := 'application:' || new.id || ':queued';
  elsif new.blocker is null and old.blocker is not null
    and new.draft is not distinct from old.draft and new.revision=old.revision
    and new.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then
    event_kind := 'preparation_blocker_cleared';
    event_text := 'Recorded application progress superseded the preparation blocker';
    key := 'application:' || new.id || ':preparation-blocker-cleared:' || new.revision;
  elsif new.draft is distinct from old.draft or new.blocker is distinct from old.blocker then
    event_kind := 'draft_updated'; event_text := 'Draft updated; previous approval no longer applies';
    key := 'application:' || new.id || ':revision:' || new.revision;
  elsif new.status = 'Approved' and old.status <> 'Approved' then
    event_kind := 'draft_approved'; event_text := 'Exact draft revision approved; not submitted';
    key := 'application:' || new.id || ':approved:' || new.revision;
  else return new;
  end if;
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
    values(new.user_id,new.id,key,event_kind,event_actor,jsonb_build_object('text',event_text,'revision',new.revision))
    on conflict(user_id,event_key) do nothing;
  return new;
end $$;

-- Reconcile legacy tracked rows through the same transition. Preserve draft,
-- revision, submission timestamp/receipt, attempts and historical job outcomes.
update public.applications set status=status
where status in ('Submitted','Interview','Offer','Rejected','Withdrawn') and blocker is not null
  and not exists(select 1 from public.submission_attempts
    where application_id=applications.id and state in ('claimed','started','uncertain'));
