begin;
-- Keep the historical batch and all application records; only hide this item.
alter table public.batch_items add column dismissed_at timestamptz;
create function private.dismiss_batch_item(owner_id uuid, batch_id_arg uuid, job_id_arg text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.batch_items;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if batch_id_arg is null or job_id_arg is null or length(job_id_arg) not between 1 and 2000 then raise exception 'Batch and job required' using errcode='22023'; end if;
 update public.batch_items set dismissed_at=coalesce(dismissed_at,now())
 where user_id=owner_id and batch_id=batch_id_arg and job_id=job_id_arg returning * into item;
 if not found then raise exception 'Owned batch item not found' using errcode='P0002'; end if;
 return jsonb_build_object('batchId',item.batch_id,'jobId',item.job_id,'dismissedAt',item.dismissed_at);
end $$;
revoke all on function private.dismiss_batch_item(uuid,uuid,text) from public,anon,authenticated;
create function public.dismiss_batch_item(batch_id_arg uuid,job_id_arg text) returns jsonb
language sql security definer set search_path='' as $$
 select private.dismiss_batch_item(auth.uid(),batch_id_arg,job_id_arg);
$$;
revoke all on function public.dismiss_batch_item(uuid,text) from public,anon;
grant execute on function public.dismiss_batch_item(uuid,text) to authenticated;
alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_batch_dismiss;
alter function public.agent_dispatch_before_batch_dismiss(text,text,jsonb) set schema private;
revoke all on function private.agent_dispatch_before_batch_dismiss(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c private.agent_connections;
begin
 if operation<>'batches.item.dismiss' then return private.agent_dispatch_before_batch_dismiss(credential_hash,operation,payload); end if;
 perform private.agent_dispatch_before_batch_dismiss(credential_hash,'credentials.verify','{}');
 select * into c from private.agent_connections where token_hash=credential_hash;
 if not 'activity:write'=any(c.scopes) then raise exception 'Scope required' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& array['batchId','jobId'] or exists(select 1 from jsonb_object_keys(payload) k where k not in ('batchId','jobId')) or jsonb_typeof(payload->'batchId') is distinct from 'string' or jsonb_typeof(payload->'jobId') is distinct from 'string' then raise exception 'Invalid arguments' using errcode='22023'; end if;
 return private.dismiss_batch_item(c.user_id,(payload->>'batchId')::uuid,payload->>'jobId');
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
