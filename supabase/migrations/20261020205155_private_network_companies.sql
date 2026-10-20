-- Private company research, independent of contacts and applications.
create table public.network_companies (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 record jsonb not null, revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 unique(user_id,id)
);
create unique index network_company_name on public.network_companies(user_id,lower(regexp_replace(btrim(record->>'name'),'\s+',' ','g')));
alter table public.network_companies enable row level security;
create policy network_company_read on public.network_companies for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.network_companies from public,anon,authenticated;
grant select on public.network_companies to authenticated;
grant all on public.network_companies to service_role;

create function private.validate_network_company(r jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare k text; s jsonb; d text;
begin
 if jsonb_typeof(r) is distinct from 'object' or octet_length(r::text)>70000
 or not r ?& array['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate','sources','contactIds','applicationIds','archived']
 or exists(select 1 from jsonb_object_keys(r) v where v not in ('name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate','sources','contactIds','applicationIds','archived')) then raise exception 'Invalid company record' using errcode='22023'; end if;
 foreach k in array array['name','website','priority','interest','targetTeams','concerns','research','nextAction','followUpDate'] loop
  if jsonb_typeof(r->k) is distinct from 'string' or length(r->>k)>(case k when 'name' then 200 when 'website' then 2048 when 'priority' then 30 when 'followUpDate' then 10 else 10000 end) then raise exception 'Invalid company field' using errcode='22023'; end if;
 end loop;
 if length(btrim(r->>'name'))=0 or r->>'priority' not in ('Apply Now','Strong Consider','Skip Unless Team Fit') or jsonb_typeof(r->'archived') is distinct from 'boolean' then raise exception 'Invalid company name or priority' using errcode='22023'; end if;
 if r->>'website'<>'' and (r->>'website' !~ '^https://[^/@[:space:]]+([/?#]|$)' or r->>'website' ~ '^https://[^/]*@') then raise exception 'HTTPS website required' using errcode='22023'; end if;
 d:=r->>'followUpDate';
 if d<>'' and (d !~ '^\d{4}-\d{2}-\d{2}$' or to_char(d::date,'YYYY-MM-DD')<>d) then raise exception 'Invalid follow-up date' using errcode='22023'; end if;
 if jsonb_typeof(r->'sources') is distinct from 'array' or jsonb_array_length(r->'sources')>30 then raise exception 'Invalid sources' using errcode='22023'; end if;
 for s in select value from jsonb_array_elements(r->'sources') loop
  if jsonb_typeof(s) is distinct from 'object' or not s ?& array['title','url','observedAt','summary'] or exists(select 1 from jsonb_object_keys(s) v where v not in ('title','url','observedAt','summary')) then raise exception 'Invalid source' using errcode='22023'; end if;
  foreach k in array array['title','url','observedAt','summary'] loop
   if jsonb_typeof(s->k) is distinct from 'string' or length(s->>k)>(case k when 'title' then 200 when 'url' then 2048 when 'observedAt' then 10 else 2000 end) then raise exception 'Invalid source field' using errcode='22023'; end if;
  end loop;
  if length(btrim(s->>'title'))=0 or s->>'url' !~ '^https://[^/@[:space:]]+([/?#]|$)' or s->>'url' ~ '^https://[^/]*@' then raise exception 'HTTPS source required' using errcode='22023'; end if;
  d:=s->>'observedAt'; if d !~ '^\d{4}-\d{2}-\d{2}$' or to_char(d::date,'YYYY-MM-DD')<>d then raise exception 'Source date required' using errcode='22023'; end if;
 end loop;
 foreach k in array array['contactIds','applicationIds'] loop
  if jsonb_typeof(r->k) is distinct from 'array' or jsonb_array_length(r->k)>100 then raise exception 'Invalid company links' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(r->k) v where jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 200) or (select count(distinct v) from jsonb_array_elements(r->k) v)<>jsonb_array_length(r->k) then raise exception 'Invalid company links' using errcode='22023'; end if;
 end loop;
end $$;
revoke all on function private.validate_network_company(jsonb) from public,anon,authenticated;

create function private.network_action(owner uuid,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare row public.network_companies; r jsonb; cid uuid; ver integer; page_limit integer; page_offset integer;
begin
 if owner is null or jsonb_typeof(payload) is distinct from 'object' then raise exception 'Sign in required' using errcode='42501'; end if;
 if operation='network.companies.read' then
  if exists(select 1 from jsonb_object_keys(payload) k where k not in ('offset','limit')) then raise exception 'Unknown read arguments' using errcode='22023'; end if;
  page_limit:=coalesce((payload->>'limit')::integer,100);page_offset:=coalesce((payload->>'offset')::integer,0);
  if page_limit not between 1 and 100 or page_offset<0 then raise exception 'Invalid page' using errcode='22023'; end if;
  return jsonb_build_object('companies',(select coalesce(jsonb_agg(to_jsonb(c)-'user_id' order by id),'[]') from (select * from public.network_companies where user_id=owner order by id limit page_limit offset page_offset) c),'total',(select count(*) from public.network_companies where user_id=owner));
 end if;
 if operation<>'network.company.save' or not payload ?& array['id','expectedRevision','record'] or exists(select 1 from jsonb_object_keys(payload) k where k not in ('id','expectedRevision','record')) or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or payload->>'expectedRevision' !~ '^\d+$' then raise exception 'Invalid company operation' using errcode='22023'; end if;
 cid:=(payload->>'id')::uuid; ver:=(payload->>'expectedRevision')::integer;r:=payload->'record';
 if cid is null or ver is null or ver<0 then raise exception 'ID and revision required' using errcode='22023'; end if;
 perform private.validate_network_company(r);
 if exists(select 1 from jsonb_array_elements_text(r->'contactIds') k where not exists(select 1 from public.outreach_contacts c where c.user_id=owner and c.id=k and c.deleted_at is null))
 or exists(select 1 from jsonb_array_elements_text(r->'applicationIds') k where not exists(select 1 from public.applications a where a.user_id=owner and a.id::text=k)) then raise exception 'Owned company links required' using errcode='42501'; end if;
 -- Serialize creates as well as updates; repeated exact saves replay safely.
 perform pg_advisory_xact_lock(hashtextextended(owner::text||cid::text,0));
 select * into row from public.network_companies where id=cid for update;
 if found then
  if row.user_id<>owner then raise exception 'Owned company required' using errcode='42501';end if;
  if row.revision=ver+1 and row.record=r then return to_jsonb(row)-'user_id';end if;
  if row.revision<>ver then raise exception 'Company changed' using errcode='40001';end if;
  update public.network_companies set record=r,revision=revision+1,updated_at=now() where id=cid returning * into row;
 else
  if ver<>0 then raise exception 'Company changed' using errcode='40001';end if;
  insert into public.network_companies(id,user_id,record) values(cid,owner,r) returning * into row;
 end if;
 return to_jsonb(row)-'user_id';
end $$;
revoke all on function private.network_action(uuid,text,jsonb) from public,anon,authenticated;

create function public.network_action(operation text,payload jsonb,p_expected_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null or auth.uid() is distinct from p_expected_owner then raise exception 'Account changed' using errcode='42501';end if; return private.network_action(auth.uid(),operation,payload);end $$;
revoke all on function public.network_action(text,jsonb,uuid) from public,anon;
grant execute on function public.network_action(text,jsonb,uuid) to authenticated;

create function public.agent_network_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections;
begin
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'workspace:read'=any(c.scopes) or (operation<>'network.companies.read' and not 'network:write'=any(c.scopes)) then raise exception 'Network scope required' using errcode='42501'; end if;
 return private.network_action(c.user_id,operation,payload);
end $$;
revoke all on function public.agent_network_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_network_dispatch(text,text,jsonb) to service_role;
