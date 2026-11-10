-- One current change pointer per owned record, including tombstones. Not a second
-- workflow store: all values are read from the existing authoritative tables.
create table private.workspace_delta_keys (
 user_id uuid not null references auth.users(id) on delete cascade,
 table_name text not null, row_key text not null, version bigint not null,
 primary key(user_id,table_name,row_key)
);
alter table private.workspace_delta_keys enable row level security;
revoke all on private.workspace_delta_keys from public,anon,authenticated;
create index workspace_delta_cursor on private.workspace_delta_keys(user_id,version);

create function private.record_workspace_delta(owner_id uuid,tab text,k text) returns void
language plpgsql security definer set search_path='' as $$
declare v bigint;
begin
 if owner_id is null or k is null or not exists(select 1 from auth.users where id=owner_id) then return;end if;
 -- The same owner row serializes writers; the cursor cannot pass an uncommitted write.
 insert into public.workspace_changes(user_id) values(owner_id)
 on conflict(user_id) do update set version=public.workspace_changes.version+1 returning version into v;
 insert into private.workspace_delta_keys values(owner_id,tab,k,v)
 on conflict(user_id,table_name,row_key) do update set version=excluded.version;
end $$;
revoke all on function private.record_workspace_delta(uuid,text,text) from public,anon,authenticated;

create or replace function private.workspace_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 k text; old_key text; previous jsonb;
begin
 k:=case when tg_table_name='batch_items' then (r->>'batch_id')||':'||(r->>'job_id')
 when tg_table_name in ('profiles','preferences','preparation_planner_settings') then r->>'user_id'
 else coalesce(r->>'id',r->>'application_id',r->>'user_id') end;
 perform private.record_workspace_delta((r->>'user_id')::uuid,tg_table_name,k);
 if tg_op='UPDATE' then
  previous:=to_jsonb(old);
  old_key:=case when tg_table_name='batch_items' then (previous->>'batch_id')||':'||(previous->>'job_id')
   when tg_table_name in ('profiles','preferences','preparation_planner_settings') then previous->>'user_id'
   else coalesce(previous->>'id',previous->>'application_id',previous->>'user_id') end;
  if old.user_id is distinct from new.user_id or old_key is distinct from k then
   perform private.record_workspace_delta(old.user_id,tg_table_name,old_key);
  end if;
 end if;
 return null;
end $$;

create function private.workspace_posting_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb; j text; previous_j text; owner_id uuid;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 owner_id:=(r->>'user_id')::uuid;
 if tg_table_name='search_listings' then
  j:=r->>'job_id';
  if tg_op='UPDATE' then previous_j:=old.job_id;end if;
 else
  select job_id into j from public.search_listings where id=(r->>'listing_id')::uuid and user_id=owner_id;
 end if;
 perform private.record_workspace_delta(owner_id,'posting_evidence',j);
 if previous_j is distinct from j then perform private.record_workspace_delta(owner_id,'posting_evidence',previous_j);end if;
 return null;
end $$;
revoke all on function private.workspace_posting_changed() from public,anon,authenticated;
create trigger workspace_posting_changed after insert or update or delete on public.search_observations for each row execute function private.workspace_posting_changed();
create trigger workspace_posting_changed after insert or update or delete on public.search_listings for each row execute function private.workspace_posting_changed();

-- Shared employer updates refresh only the owned projections referencing that job.
create function private.workspace_job_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare r record;
begin
 for r in select user_id,'applications' tab,id::text k from public.applications where job_id=new.id
 union all select user_id,'batch_items',batch_id::text||':'||job_id from public.batch_items where job_id=new.id
 order by user_id loop perform private.record_workspace_delta(r.user_id,r.tab,r.k);end loop;
 return null;
end $$;
revoke all on function private.workspace_job_changed() from public,anon,authenticated;
create trigger workspace_job_changed after update on public.jobs for each row execute function private.workspace_job_changed();

-- Human decision history affects Action Board projections without changing an app.
create or replace function private.board_receipt_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
 perform private.record_workspace_delta((r->>'user_id')::uuid,'action_decision_receipts',r->>'decision_key');
 return null;
end $$;
drop trigger board_receipt_changed on private.action_decision_receipts;
create trigger board_receipt_changed after insert or update or delete on private.action_decision_receipts for each row execute function private.board_receipt_changed();

-- Auxiliary page readers use these pointers to avoid unrelated reloads.
do $$ declare tab text;begin
 foreach tab in array array['imported_jobs','outreach_contacts','outreach_requests','company_workspaces'] loop
  if to_regclass('public.'||tab) is not null and not exists(select 1 from pg_trigger where tgrelid=to_regclass('public.'||tab) and tgname='workspace_changed') then
   execute format('create trigger workspace_changed after insert or update or delete on public.%I for each row execute function private.workspace_changed()',tab);
  end if;
 end loop;
end $$;

do $$ declare tab text;begin
 foreach tab in array array['onboarding_sessions','agent_tasks'] loop
  execute format('create trigger workspace_changed after insert or update or delete on private.%I for each row execute function private.workspace_changed()',tab);
 end loop;
end $$;

create function private.workspace_sync_rows(owner_id uuid,tab text,keys text[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare projection text:='to_jsonb(t)'; key_expr text:='t.id::text'; key_filter text:='t.id=any($2::uuid[])'; rows jsonb;
begin
 if tab='posting_evidence' then
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into rows from (
   select distinct on (l.job_id) l.job_id, o.checked_at,o.liveness,o.employer_posted_at,o.description
   from public.search_observations o join public.search_listings l on l.id=o.listing_id and l.user_id=o.user_id
   where o.user_id=owner_id and l.job_id is not null and (keys is null or l.job_id=any(keys))
   order by l.job_id,o.checked_at desc,o.created_at desc,o.id desc
  ) e;return rows;
 end if;
 if not tab=any(array['profiles','preferences','resumes','answer_library','applications','activity_events','submission_attempts','application_milestones','action_inbox','job_batches','batch_items']) then raise exception 'Unsupported sync table';end if;
 if tab in ('profiles','preferences') then key_expr:='t.user_id::text';key_filter:='t.user_id=any($2::uuid[])';end if;
 if tab='batch_items' then key_expr:='t.batch_id::text||'':''||t.job_id';key_filter:='(t.batch_id,t.job_id) in (select split_part(k,'':'',1)::uuid,substring(k from 38) from unnest($2) k)';end if;
 if tab in ('applications','batch_items') then
  projection:='to_jsonb(t)||jsonb_build_object(''jobs'',(select to_jsonb(j) from public.jobs j where j.id=t.job_id))';
 elsif tab='submission_attempts' then
  projection:='jsonb_build_object(''id'',t.id,''user_id'',t.user_id,''application_id'',t.application_id,''state'',t.state,''started_at'',t.started_at,''created_at'',t.created_at,''finished_at'',t.finished_at,''receipt'',t.receipt,''resume_snapshot'',t.context_snapshot->''resume'')';
 end if;
 execute format('select coalesce(jsonb_agg(%s order by %s),''[]'') from public.%I t where t.user_id=$1%s',projection,key_expr,tab,case when keys is null then '' else ' and '||key_filter end) into rows using owner_id,keys;
 return rows;
end $$;
revoke all on function private.workspace_sync_rows(uuid,text,text[]) from public,anon,authenticated;

-- STABLE provides one statement snapshot for the cursor, pointers and projections.
-- Browser identity is derived from Auth. No caller-supplied owner or table names.
create function public.sync_workspace(after_version bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); v bigint; tab text; keys text[]; rows jsonb; gone jsonb;
 result jsonb:='{}'; signals jsonb; full_read boolean;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if after_version<0 then raise exception 'Invalid cursor' using errcode='22023';end if;
 select coalesce((select version from public.workspace_changes where user_id=owner_id),0) into v;
 if after_version=v then return jsonb_build_object('mode','delta','version',v,'changes','{}'::jsonb,'signals','[]'::jsonb);end if;
 full_read:=after_version is null or after_version>v;
 if full_read then
  foreach tab in array array['profiles','preferences','resumes','answer_library','applications','activity_events','submission_attempts','application_milestones','action_inbox','job_batches','batch_items','posting_evidence'] loop
   result:=result||jsonb_build_object(tab,private.workspace_sync_rows(owner_id,tab));
  end loop;
  return jsonb_build_object('mode','snapshot','version',v,'rows',result,'signals',jsonb_build_array('*'));
 end if;
 for tab,keys in select d.table_name,array_agg(d.row_key) from private.workspace_delta_keys d where d.user_id=owner_id and d.version>after_version and d.version<=v group by d.table_name loop
  if tab=any(array['profiles','preferences','resumes','answer_library','applications','activity_events','submission_attempts','application_milestones','action_inbox','job_batches','batch_items','posting_evidence']) then
   rows:=private.workspace_sync_rows(owner_id,tab,keys);
   select coalesce(jsonb_agg(k),'[]') into gone from unnest(keys) k where not exists(
    select 1 from jsonb_array_elements(rows) r where k=case when tab in ('profiles','preferences') then r->>'user_id' when tab='batch_items' then (r->>'batch_id')||':'||(r->>'job_id') when tab='posting_evidence' then r->>'job_id' else r->>'id' end);
   result:=result||jsonb_build_object(tab,jsonb_build_object('upserts',rows,'deleted',gone));
  end if;
 end loop;
 select coalesce(jsonb_agg(distinct table_name),'[]') into signals from private.workspace_delta_keys where user_id=owner_id and version>after_version and version<=v;
 return jsonb_build_object('mode','delta','version',v,'changes',result,'signals',signals);
end $$;
revoke all on function public.sync_workspace(bigint) from public,anon;
grant execute on function public.sync_workspace(bigint) to authenticated;
