begin;
create table private.mcp_event_subscriptions (
 id text primary key, connection_id uuid not null references private.agent_connections(id) on delete cascade,
 url text not null, secret text not null, old_secret text, rotate_until timestamptz,
 expires_at timestamptz not null, verified_until timestamptz not null,
 created_at timestamptz not null default now()
);
create index mcp_event_connection on private.mcp_event_subscriptions(connection_id);
create table private.mcp_event_deliveries (
 id uuid primary key default gen_random_uuid(), subscription_id text not null references private.mcp_event_subscriptions(id) on delete cascade,
 event_id uuid not null references public.activity_events(id) on delete cascade,
 attempts integer not null default 0, due_at timestamptz not null default now(), lease uuid, lease_until timestamptz,
 done boolean not null default false, unique(subscription_id,event_id)
);
create index mcp_event_due on private.mcp_event_deliveries(due_at) where not done;
alter table private.mcp_event_subscriptions enable row level security;
alter table private.mcp_event_deliveries enable row level security;
revoke all on private.mcp_event_subscriptions,private.mcp_event_deliveries from public,anon,authenticated;
grant all on private.mcp_event_subscriptions,private.mcp_event_deliveries to service_role;

create function private.enqueue_mcp_event() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.actor='system' and new.kind in ('muse.answer_confirmed','muse.preferences_changed','muse.profile_changed','muse.backend_job_finished','muse.application_timeline_changed','muse.schedule_changed','muse.action_decision','muse.application_requested') then
  insert into private.mcp_event_deliveries(subscription_id,event_id)
   select s.id,new.id from private.mcp_event_subscriptions s join private.agent_connections c on c.id=s.connection_id
   where c.user_id=new.user_id and c.revoked_at is null and c.expires_at>now() and s.expires_at>now() and array['workspace:read','activity:write']::text[]<@c.scopes
   on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function private.enqueue_mcp_event() from public,anon,authenticated;
create trigger mcp_work_available after insert on public.activity_events for each row execute function private.enqueue_mcp_event();
-- Existing workspace_changes Realtime invalidations wake the outbox consumer.
-- No publication, table grants or existing row policies are changed.

create function public.mcp_event_dispatch(action text,args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare connection private.agent_connections; subscription private.mcp_event_subscriptions; output jsonb; code integer;
begin
 if action in ('authorize','read','save','remove') then
  perform public.agent_dispatch(args->>'hash','credentials.verify','{}');
  select * into strict connection from private.agent_connections where token_hash=args->>'hash';
  if not (array['workspace:read','activity:write']::text[]<@connection.scopes) then raise exception 'Workspace scope required' using errcode='42501';end if;
  if action='authorize' then return jsonb_build_object('connectionId',connection.id);end if;
  select * into subscription from private.mcp_event_subscriptions where id=args->>'id' and connection_id=connection.id for update;
  if action='read' then return to_jsonb(subscription);end if;
  if action='remove' then delete from private.mcp_event_subscriptions where id=args->>'id' and connection_id=connection.id;return '{}';end if;
  if length(args->>'id')<>68 or (args->>'url') !~ '^https://' or length(args->>'url')>2048 or (args->>'secret') !~ '^whsec_[A-Za-z0-9+/]+=*$'
   or (args->>'expires')::timestamptz<=now() or (args->>'expires')::timestamptz>now()+interval '1 day 1 minute' then raise exception 'Invalid subscription';end if;
  if subscription.id is null and (select count(*) from private.mcp_event_subscriptions where connection_id=connection.id)>=10 then raise exception 'Subscription limit';end if;
  insert into private.mcp_event_subscriptions(id,connection_id,url,secret,expires_at,verified_until)
   values(args->>'id',connection.id,args->>'url',args->>'secret',least((args->>'expires')::timestamptz,connection.expires_at),(args->>'verifiedUntil')::timestamptz)
   on conflict(id) do update set secret=excluded.secret,
    old_secret=case when private.mcp_event_subscriptions.secret<>excluded.secret then private.mcp_event_subscriptions.secret else private.mcp_event_subscriptions.old_secret end,
    rotate_until=case when private.mcp_event_subscriptions.secret<>excluded.secret then now()+interval '5 minutes' else private.mcp_event_subscriptions.rotate_until end,
    expires_at=excluded.expires_at,verified_until=excluded.verified_until
   where private.mcp_event_subscriptions.connection_id=connection.id;
  return jsonb_build_object('expiresAt',least((args->>'expires')::timestamptz,connection.expires_at));
 end if;
 if action='claim' then
  -- Remove revoked/expired destinations and their keys, including queued work.
  delete from private.mcp_event_subscriptions s using private.agent_connections c where c.id=s.connection_id
   and (s.expires_at<=now() or c.revoked_at is not null or c.expires_at<=now() or not (array['workspace:read','activity:write']::text[]<@c.scopes));
  update private.mcp_event_subscriptions set old_secret=null,rotate_until=null where rotate_until<=now();
  update private.mcp_event_deliveries set done=true where not done and attempts>=6 and (lease_until is null or lease_until<=now());
  with candidates as (
   select d.id from private.mcp_event_deliveries d where not done and attempts<6 and due_at<=now() and (lease_until is null or lease_until<=now()) order by due_at limit 20 for update skip locked
  ), leased as (
   update private.mcp_event_deliveries d set lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 from candidates x where d.id=x.id returning d.id,d.lease
  ) select coalesce(jsonb_agg(to_jsonb(leased)),'[]') into output from leased;
  return output;
 end if;
 if action='delivery' then
  select jsonb_build_object('id',s.id,'url',s.url,'secret',s.secret,'old_secret',s.old_secret,'rotate_until',s.rotate_until,'event_id',e.id,'occurred_at',e.occurred_at,'kind',e.kind) into output
  from private.mcp_event_deliveries d join private.mcp_event_subscriptions s on s.id=d.subscription_id
  join private.agent_connections c on c.id=s.connection_id join public.activity_events e on e.id=d.event_id
  where d.id=(args->>'id')::uuid and d.lease=(args->>'lease')::uuid and not d.done and d.lease_until>now()
   and c.revoked_at is null and c.expires_at>now() and s.expires_at>now() and array['workspace:read','activity:write']::text[]<@c.scopes and e.user_id=c.user_id;
  return output;
 end if;
 if action='finish' then
  code:=(args->>'status')::integer;
  if code=410 then delete from private.mcp_event_subscriptions where id=(select subscription_id from private.mcp_event_deliveries where id=(args->>'id')::uuid and lease=(args->>'lease')::uuid);return '{}';end if;
  update private.mcp_event_deliveries set done=(code between 200 and 299 or code=413 or attempts>=6 or (code between 400 and 499 and code not in (408,429))),
   due_at=now()+make_interval(secs=>least(300,power(2,attempts)::integer)),lease=null,lease_until=null
   where id=(args->>'id')::uuid and lease=(args->>'lease')::uuid;
  return '{}';
 end if;
 if action='next' then
  select to_jsonb(min(greatest(due_at,coalesce(lease_until,due_at)))) into output from private.mcp_event_deliveries where not done;
  return output;
 end if;
 raise exception 'Unknown event operation';
end $$;
revoke all on function public.mcp_event_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_event_dispatch(text,jsonb) to service_role;
commit;
