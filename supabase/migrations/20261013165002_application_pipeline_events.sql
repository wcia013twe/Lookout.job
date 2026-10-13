-- One durable application timeline. Triggered lifecycle entries cannot be forged by a client.
create function private.log_application_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare event_kind text; event_text text; key text; event_actor text;
begin
  event_actor := case when auth.uid() = new.user_id then 'user' else 'agent' end;
  if TG_OP = 'INSERT' then
    event_kind := 'application_queued'; event_text := 'Application queued';
    key := 'application:' || new.id || ':queued';
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
revoke all on function private.log_application_activity() from public,anon,authenticated;
create trigger log_application_activity after insert or update on public.applications
for each row execute function private.log_application_activity();

-- Human progress reporting is deliberately distinct from runner submission receipts.
create function private.set_application_stage(p_application_id uuid, expected_revision integer, target_status text, note text)
returns public.applications language plpgsql security definer set search_path = '' as $$
declare a public.applications; update_note text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into a from public.applications where id = p_application_id and user_id = auth.uid() for update;
  if not found or a.revision <> expected_revision then raise exception 'Application changed; reload and review again'; end if;
  if target_status not in ('Submitted','Interview','Offer','Rejected','Withdrawn') then raise exception 'Choose a tracking stage'; end if;
  if target_status = a.status then return a; end if;
  update_note := trim(coalesce(note,''));
  if length(update_note) = 0 or length(update_note) > 2000 then raise exception 'Add an update note (up to 2000 characters)'; end if;
  if target_status in ('Interview','Offer') and a.status not in ('Submitted','Interview','Offer') then raise exception 'Record submission before tracking an interview or offer'; end if;
  update public.applications set status = target_status,
    submitted_at = case when target_status = 'Submitted' then coalesce(submitted_at,now()) else submitted_at end
    where id = a.id returning * into a;
  insert into public.activity_events(user_id,application_id,event_key,kind,actor,payload)
    values(auth.uid(),a.id,'stage:' || gen_random_uuid(),'stage_changed','user',
      jsonb_build_object('text','You reported ' || target_status || ': ' || update_note,
        'status',target_status,'note',update_note,'reported',true,'revision',a.revision));
  return a;
end $$;
revoke all on function private.set_application_stage(uuid,integer,text,text) from public,anon;
grant execute on function private.set_application_stage(uuid,integer,text,text) to authenticated;
create function public.set_application_stage(application_id uuid, expected_revision integer, target_status text, note text)
returns public.applications language sql security invoker set search_path = '' as $$
  select private.set_application_stage(application_id,expected_revision,target_status,note);
$$;
revoke all on function public.set_application_stage(uuid,integer,text,text) from public,anon;
grant execute on function public.set_application_stage(uuid,integer,text,text) to authenticated;

-- Draft mutation never turns a submitted application back into a draft.
create or replace function private.version_application() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.draft is distinct from old.draft or new.blocker is distinct from old.blocker then
    if old.status in ('Submitted','Interview','Offer','Rejected','Withdrawn') then
      raise exception 'Tracked application draft cannot be edited';
    end if;
    new.revision := old.revision + 1;
    new.status := case when nullif(new.blocker,'') is not null then 'Blocked'
      when new.draft->>'questionsReviewed' = 'true' then 'Awaiting approval' else 'Draft' end;
  else new.revision := old.revision; end if;
  new.updated_at := now(); return new;
end $$;
