-- Supabase deployment input. Apply once to a dedicated project, then record as a migration.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  facts jsonb not null default '{}' check (jsonb_typeof(facts) = 'object'),
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  search jsonb not null default '{}' check (jsonb_typeof(search) = 'object'),
  tier_lists jsonb not null default '[]' check (jsonb_typeof(tier_lists) = 'array'),
  active_tier_list_id text,
  theme jsonb not null default '{"pack":"base"}',
  updated_at timestamptz not null default now()
);
create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, variant text not null default 'Master', version integer not null default 1 check(version > 0),
  object_path text, reference_url text,
  content_hash text, created_at timestamptz not null default now(),
  check (object_path is not null or reference_url is not null),
  check (object_path is null or split_part(object_path, '/', 1) = user_id::text),
  check (reference_url is null or reference_url ~ '^https://'),
  unique(user_id,id)
);
create table public.answer_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null, answer text not null, context jsonb not null default '{}',
  provenance text not null check(provenance in ('user','agent')),
  verified_at timestamptz, updated_at timestamptz not null default now()
);
-- Employer facts are shared; candidate fit and personal notes belong in batch items.
create table public.jobs (
  id text primary key, canonical_url text not null unique,
  employer jsonb not null check(jsonb_typeof(employer) = 'object'),
  discovered_at timestamptz not null default now(), verified_at timestamptz
);
create table public.job_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, batch_date date not null default current_date,
  source_event_id text not null, created_at timestamptz not null default now(),
  unique(user_id,source_event_id), unique(user_id,id)
);
create table public.batch_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null, job_id text not null references public.jobs(id),
  position integer not null check(position >= 0), recommendation jsonb not null default '{}',
  opened_at timestamptz, saved_at timestamptz,
  primary key(batch_id,job_id),
  foreign key(user_id,batch_id) references public.job_batches(user_id,id) on delete cascade
);
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null references public.jobs(id),
  status text not null default 'Queued' check(status in ('Queued','Draft','Awaiting approval','Approved','Blocked','Submitted','Interview','Rejected','Offer','Withdrawn')),
  revision integer not null default 0 check(revision >= 0),
  draft jsonb not null default '{}' check(jsonb_typeof(draft) = 'object'),
  blocker text, submitted_at timestamptz, receipt jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id,job_id), unique(user_id,id)
);
create table public.approvals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null, revision integer not null,
  snapshot jsonb not null, approved_at timestamptz not null default now(),
  foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade,
  unique(application_id,revision)
);
create table public.activity_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid, event_key text not null, kind text not null,
  actor text not null check(actor in ('user','agent','system')), payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  foreign key(user_id,application_id) references public.applications(user_id,id) on delete cascade,
  unique(user_id,event_key)
);
-- Public-safe, explicit opt-in projection. Never copy profiles into this table.
create table public.leaderboard_entries (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias text not null check(length(alias) between 1 and 40), opted_in boolean not null default false,
  xp bigint not null default 0 check(xp >= 0), streak integer not null default 0 check(streak >= 0),
  applications_count integer not null default 0 check(applications_count >= 0),
  updated_at timestamptz not null default now()
);
-- Credential hashes only; provisioning and scoped agent access require a server gateway.
create table private.agent_connections (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, token_hash text not null unique,
  scopes text[] not null default array['batches:write','drafts:write','activity:write'],
  created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz
);
alter table private.agent_connections enable row level security;

grant usage on schema private to service_role;
grant all on private.agent_connections to service_role;
-- Hosted projects may have permissive default table grants; reset them explicitly.
revoke all on public.profiles, public.preferences, public.resumes, public.answer_library,
  public.jobs, public.job_batches, public.batch_items, public.applications,
  public.approvals, public.activity_events, public.leaderboard_entries from anon, authenticated;

create index resumes_owner_idx on public.resumes(user_id);
create index answers_owner_idx on public.answer_library(user_id);
create index batches_owner_date_idx on public.job_batches(user_id,batch_date desc);
create index batch_items_owner_idx on public.batch_items(user_id,batch_id);
create index applications_owner_status_idx on public.applications(user_id,status);
create index approvals_owner_idx on public.approvals(user_id,application_id);
create index activity_owner_time_idx on public.activity_events(user_id,occurred_at desc);
create index activity_application_idx on public.activity_events(user_id,application_id);
create index agents_owner_idx on private.agent_connections(user_id);

do $$ declare t text; begin
  foreach t in array array['profiles','preferences','resumes','answer_library','job_batches','batch_items','applications'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.jobs enable row level security;
create policy catalog_read on public.jobs for select to anon,authenticated using(true);
grant select on public.jobs to anon,authenticated;
alter table public.approvals enable row level security;
create policy approvals_read on public.approvals for select to authenticated using((select auth.uid()) = user_id);
grant select on public.approvals to authenticated;
alter table public.activity_events enable row level security;
create policy events_read on public.activity_events for select to authenticated using((select auth.uid()) = user_id);
create policy events_append on public.activity_events for insert to authenticated with check((select auth.uid()) = user_id and actor = 'user');
grant select,insert on public.activity_events to authenticated;
alter table public.leaderboard_entries enable row level security;
create policy leaderboard_read on public.leaderboard_entries for select to authenticated using(opted_in or (select auth.uid()) = user_id);
create policy leaderboard_create on public.leaderboard_entries for insert to authenticated with check((select auth.uid()) = user_id and xp = 0 and streak = 0 and applications_count = 0);
create policy leaderboard_edit on public.leaderboard_entries for update to authenticated using((select auth.uid()) = user_id) with check((select auth.uid()) = user_id);
grant select,insert on public.leaderboard_entries to authenticated;
grant update(alias,opted_in) on public.leaderboard_entries to authenticated;

create function private.version_application() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.draft is distinct from old.draft or new.blocker is distinct from old.blocker then
    new.revision := old.revision + 1;
    new.status := case when nullif(new.blocker,'') is not null then 'Blocked' else 'Draft' end;
  else new.revision := old.revision; end if;
  new.updated_at := now(); return new;
end $$;
create trigger version_application before update on public.applications for each row execute function private.version_application();

-- This is the only client approval path; lock the row to prevent approval/edit races.
create function private.approve_application(p_application_id uuid, expected_revision integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.applications; p public.profiles; r public.resumes; approval_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into a from public.applications where id = p_application_id and user_id = auth.uid() for update;
  if not found or a.revision <> expected_revision then raise exception 'Draft changed; review again'; end if;
  if a.status not in ('Draft','Queued','Awaiting approval','Approved') or nullif(a.blocker,'') is not null then raise exception 'Application cannot be approved'; end if;
  select * into p from public.profiles where user_id = auth.uid() for share;
  if p.verified_at is null or coalesce(p.facts->>'name','') = '' or coalesce(p.facts->>'email','') = '' then raise exception 'Verified profile required'; end if;
  select * into r from public.resumes where id::text = a.draft->>'resumeId' and user_id = auth.uid() for share;
  if not found then raise exception 'Owned resume required'; end if;
  if (a.draft->>'questionsReviewed') is distinct from 'true' or jsonb_typeof(a.draft->'questions') is distinct from 'array' then raise exception 'Review employer questions first'; end if;
  if exists(select 1 from jsonb_array_elements(a.draft->'questions') q where length(trim(coalesce(q->>'question',''))) = 0 or length(trim(coalesce(q->>'answer',''))) = 0) then raise exception 'Complete every answer'; end if;
  insert into public.approvals(user_id,application_id,revision,snapshot)
    values(auth.uid(),a.id,a.revision,jsonb_build_object('draft',a.draft,'profile',p.facts,'resume',to_jsonb(r)))
    on conflict (application_id,revision) do nothing returning id into approval_id;
  if approval_id is null then select id into approval_id from public.approvals where approvals.application_id = a.id and revision = a.revision; end if;
  update public.applications set status = 'Approved' where id = a.id;
  return approval_id;
end $$;
revoke all on function private.approve_application(uuid,integer) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.approve_application(uuid,integer) to authenticated;
create function public.approve_application(application_id uuid, expected_revision integer) returns uuid
language sql security invoker set search_path = '' as $$
  select private.approve_application(application_id, expected_revision);
$$;
revoke all on function public.approve_application(uuid,integer) from public,anon;
grant execute on function public.approve_application(uuid,integer) to authenticated;
-- Function checks ownership explicitly; no user-controlled metadata participates in auth.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('resumes','resumes',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create policy resume_files_owner on storage.objects for all to authenticated
using(bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check(bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
