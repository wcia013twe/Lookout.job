-- A work-history entry edit is lightweight CRUD. No queue, Node worker or new store.
create function private.edit_work_experience(owner_id uuid,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.profiles; history jsonb; item jsonb; fields jsonb; result jsonb;
 action text; idx integer; k text; v jsonb;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or payload-array['action','expectedUpdatedAt','entryIndex','fields']<>'{}' or octet_length(payload::text)>210000
 or jsonb_typeof(payload->'action') is distinct from 'string' or payload->>'action' not in ('add','update','remove')
 or jsonb_typeof(payload->'expectedUpdatedAt') is distinct from 'string' then raise exception 'Work-history action and current timestamp required' using errcode='22023';end if;
 action:=payload->>'action';fields:=payload->'fields';
 if action='add' then
  if payload ? 'entryIndex' then raise exception 'Add appends a new entry' using errcode='22023';end if;
 else
  if jsonb_typeof(payload->'entryIndex') is distinct from 'number' or payload->>'entryIndex' !~ '^[0-9]{1,2}$' or (payload->>'entryIndex')::integer>49 then raise exception 'Current work-history entry index required' using errcode='22023';end if;
  idx:=(payload->>'entryIndex')::integer;
 end if;
 if action='remove' then
  if payload ? 'fields' then raise exception 'Remove accepts no fields' using errcode='22023';end if;
 else
  if jsonb_typeof(fields) is distinct from 'object' or fields='{}' or fields-array['title','company','location','employmentType','startDate','endDate','current','description']<>'{}' then raise exception 'Only work-history fields allowed' using errcode='22023';end if;
  for k,v in select * from jsonb_each(fields) loop
   if (k='current' and jsonb_typeof(v)<>'boolean') or (k<>'current' and (jsonb_typeof(v)<>'string' or length(v#>>'{}')>20000)) then raise exception 'Invalid work-history field value' using errcode='22023';end if;
  end loop;
  if action='add' and not exists(select 1 from jsonb_each_text(fields) e where e.key<>'current' and length(trim(e.value))>0) then raise exception 'Source-backed work-history details required' using errcode='22023';end if;
 end if;
 select * into p from public.profiles where user_id=owner_id for update;
 if not found then raise exception 'Owned profile not found' using errcode='P0002';end if;
 if p.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'Profile changed; reload before editing work history' using errcode='PT409';end if;
 history:=coalesce(p.facts->'workExperience','[]');
 if jsonb_typeof(history)<>'array' or jsonb_array_length(history)>50 then raise exception 'Invalid existing work history' using errcode='22023';end if;
 if action='add' then
  if jsonb_array_length(history)>=50 then raise exception 'Work-history limit reached' using errcode='22023';end if;
  history:=history||jsonb_build_array(fields);
 else
  if idx>=jsonb_array_length(history) then raise exception 'Owned work-history entry not found' using errcode='P0002';end if;
  if jsonb_typeof(history->idx)<>'object' then raise exception 'Invalid existing work-history entry' using errcode='22023';end if;
  if action='remove' then history:=history-idx;
  else history:=jsonb_set(history,array[idx::text],(history->idx)||fields);end if;
 end if;
 if history is not distinct from p.facts->'workExperience' then return to_jsonb(p);end if;
 -- Advance even within one transaction: retrying an add/remove with its old
 -- timestamp can never append/delete twice. Preserve all unrelated JSON verbatim.
 update public.profiles set facts=jsonb_set(facts,'{workExperience}',history),verified_at=null,
 updated_at=greatest(clock_timestamp(),p.updated_at+interval '1 microsecond')
 where user_id=owner_id returning to_jsonb(profiles.*) into result;
 return result;
end $$;
revoke all on function private.edit_work_experience(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.edit_work_experience(uuid,jsonb) to service_role;

-- Website and MCP share the exact same validation and versioned transaction.
create function public.edit_work_experience(payload jsonb,expected_owner uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from expected_owner then raise exception 'Account changed; reload' using errcode='42501';end if;
 return private.edit_work_experience(auth.uid(),payload);
end $$;
revoke all on function public.edit_work_experience(jsonb,uuid) from public,anon;
grant execute on function public.edit_work_experience(jsonb,uuid) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to work_experience_dispatch_previous;
revoke all on function private.work_experience_dispatch_previous(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c private.agent_connections;
begin
 if operation<>'profile.work_experience.edit' then return private.work_experience_dispatch_previous(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if c.user_id is null or not 'profile:write'=any(c.scopes) then raise exception 'Profile write scope required' using errcode='42501';end if;
 return private.edit_work_experience(c.user_id,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
