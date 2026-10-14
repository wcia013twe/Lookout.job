-- Outreach stays owner-scoped. Human requests queue preparation, never delivery.
create table public.outreach_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 companies jsonb not null check(jsonb_typeof(companies)='array' and jsonb_array_length(companies) between 1 and 50 and octet_length(companies::text)<12000),
 status text not null default 'Queued' check(status in ('Queued','Ready')), event_key text, payload_hash text, created_at timestamptz not null default now(), completed_at timestamptz
);
create index outreach_requests_owner_queue on public.outreach_requests(user_id,status,created_at);
alter table public.outreach_requests enable row level security;
create policy outreach_request_read on public.outreach_requests for select to authenticated using(user_id=(select auth.uid()));
create policy outreach_request_create on public.outreach_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='Queued' and event_key is null and payload_hash is null and completed_at is null);
revoke all on public.outreach_requests from public,anon,authenticated;
grant select on public.outreach_requests to authenticated;
grant insert(companies,user_id) on public.outreach_requests to authenticated;
grant all on public.outreach_requests to service_role;

create table public.outreach_contacts (
 id text not null default gen_random_uuid()::text, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 record jsonb not null check(jsonb_typeof(record)='object' and octet_length(record::text)<=60000), revision integer not null default 0,
 updated_at timestamptz not null default now(), deleted_at timestamptz, primary key(user_id,id)
);
alter table public.outreach_contacts enable row level security;
create policy outreach_contact_read on public.outreach_contacts for select to authenticated using(user_id=(select auth.uid()));
create policy outreach_contact_create on public.outreach_contacts for insert to authenticated with check(user_id=(select auth.uid()));
create policy outreach_contact_edit on public.outreach_contacts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.outreach_contacts from public,anon,authenticated;
grant select on public.outreach_contacts to authenticated;
grant insert(id,record) on public.outreach_contacts to authenticated;
grant update(record,deleted_at) on public.outreach_contacts to authenticated;
grant all on public.outreach_contacts to service_role;
create function private.outreach_contact_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin new.revision:=old.revision+1; new.updated_at:=now(); return new; end $$;
create trigger outreach_revision before update on public.outreach_contacts for each row execute function private.outreach_contact_revision();

create function public.save_outreach_contact(p_id text,p_expected_revision integer,p_record jsonb,p_expected_owner uuid,p_deleted boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.outreach_contacts; owner uuid:=auth.uid();
begin
 if owner is null or owner is distinct from p_expected_owner or length(p_id) not between 1 and 200 or jsonb_typeof(p_record) is distinct from 'object' then raise exception 'Sign in and provide contact' using errcode='42501'; end if;
 select * into r from public.outreach_contacts where user_id=owner and id=p_id for update;
 if found then
  if r.revision<>p_expected_revision then raise exception 'Contact changed' using errcode='40001'; end if;
  update public.outreach_contacts set record=p_record,deleted_at=case when p_deleted then now() else null end where user_id=owner and id=p_id returning * into r;
 else
  if p_expected_revision<>-1 or p_deleted then raise exception 'Contact unavailable' using errcode='40001'; end if;
  insert into public.outreach_contacts(id,record) values(p_id,p_record) returning * into r;
 end if;
 return to_jsonb(r);
end $$;
revoke all on function public.save_outreach_contact(text,integer,jsonb,uuid,boolean) from public,anon;
grant execute on function public.save_outreach_contact(text,integer,jsonb,uuid,boolean) to authenticated;

create function public.agent_outreach_dispatch(credential_hash text,operation text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections; request public.outreach_requests; r public.outreach_contacts; item jsonb; contact_id text; record_data jsonb; result jsonb;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) then raise exception 'Read scope required' using errcode='42501'; end if;
 if operation='outreach.read' then
  return jsonb_build_object('requests',(select coalesce(jsonb_agg(to_jsonb(q) order by created_at),'[]') from (select * from public.outreach_requests where user_id=c.user_id and status='Queued' order by created_at limit 100) q),'contacts',(select coalesce(jsonb_agg(to_jsonb(o) order by updated_at),'[]') from (select * from public.outreach_contacts where user_id=c.user_id and deleted_at is null order by updated_at desc limit 1000) o));
 end if;
 if operation<>'outreach.prepare' or not 'drafts:write'=any(c.scopes) then raise exception 'Draft scope required' using errcode='42501'; end if;
 select * into request from public.outreach_requests where id=(payload->>'requestId')::uuid and user_id=c.user_id for update;
 if not found then raise exception 'Owned request required' using errcode='P0002'; end if;
 if request.status='Ready' then
  if request.event_key=payload->>'eventKey' and request.payload_hash=md5(payload::text) then return jsonb_build_object('requestId',request.id,'status','Ready','reused',true); end if;
  raise exception 'Request completed' using errcode='40001';
 end if;
 if jsonb_typeof(payload->'contacts') is distinct from 'array' or jsonb_array_length(payload->'contacts') not between 1 and 100 or length(payload->>'eventKey') not between 1 and 200 then raise exception 'Invalid package' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(payload->'contacts') loop
  if jsonb_typeof(item) is distinct from 'object' or coalesce(length(btrim(item->>'company')),0)=0 or coalesce(length(btrim(item->>'contact')),0)=0 or coalesce(length(btrim(item->>'message')),0)=0 then raise exception 'Complete contact required' using errcode='22023'; end if;
  if not exists(select 1 from jsonb_array_elements_text(request.companies) company where lower(btrim(company))=lower(btrim(item->>'company'))) then raise exception 'Company not requested' using errcode='22023'; end if;
  contact_id:=item->>'id';
  if contact_id is not null then select * into r from public.outreach_contacts where id=contact_id and user_id=c.user_id for update;
  else select * into r from public.outreach_contacts where user_id=c.user_id and lower(btrim(record->>'company'))=lower(btrim(item->>'company')) and lower(btrim(coalesce(record->>'contact',record->>'name')))=lower(btrim(item->>'contact')) order by updated_at desc limit 1 for update; end if;
  record_data:=item-'id'-'expectedRevision';
  if found then
   if contact_id is null or (item->>'expectedRevision')::integer is distinct from r.revision or r.deleted_at is not null then raise exception 'Contact changed; read current revision' using errcode='40001'; end if;
   update public.outreach_contacts set record=record||record_data||jsonb_build_object('source','Muse') where id=r.id and user_id=c.user_id;
  else
   if contact_id is not null then raise exception 'Owned contact required' using errcode='P0002'; end if;
   insert into public.outreach_contacts(user_id,record) values(c.user_id,record_data||jsonb_build_object('source','Muse','status','Not asked'));
  end if;
 end loop;
 update public.outreach_requests set status='Ready',event_key=payload->>'eventKey',payload_hash=md5(payload::text),completed_at=now() where id=request.id;
 return jsonb_build_object('requestId',request.id,'status','Ready','count',jsonb_array_length(payload->'contacts'));
end $$;
revoke all on function public.agent_outreach_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_outreach_dispatch(text,text,jsonb) to service_role;
