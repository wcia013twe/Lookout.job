begin;
-- Website completion is a human action, separate from agent readiness.
alter function private.onboarding_action(uuid,text,jsonb,uuid) rename to website_onboarding_previous;
create function private.onboarding_action(owner_id uuid,operation text,payload jsonb,connection_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private.onboarding_sessions; old private.onboarding_events; response jsonb;
begin
 if operation<>'onboarding.submit_step' or payload->>'event' is distinct from 'website_complete' then
  return private.website_onboarding_previous(owner_id,operation,payload,connection_id);
 end if;
 if connection_id is not null or auth.uid() is distinct from owner_id or owner_id is null then
  raise exception 'Finish website setup in your signed-in Lookout account' using errcode='42501';
 end if;
 if jsonb_typeof(payload) is distinct from 'object' or not payload ?& array['expectedRevision','eventKey','event','data']
 or exists(select 1 from jsonb_object_keys(payload) k where k not in ('expectedRevision','eventKey','event','data'))
 or payload->'data' is distinct from '{}'::jsonb or jsonb_typeof(payload->'eventKey') is distinct from 'string'
 or length(trim(payload->>'eventKey')) not between 1 and 100
 or jsonb_typeof(payload->'expectedRevision') is distinct from 'number'
 or (payload->>'expectedRevision') !~ '^[0-9]+$' then
  raise exception 'Current revision, event key and empty data required' using errcode='22023';
 end if;
 perform private.onboarding_view(owner_id);
 select * into s from private.onboarding_sessions where user_id=owner_id for update;
 select * into old from private.onboarding_events where user_id=owner_id and event_key=payload->>'eventKey';
 if found then
  if old.request is distinct from payload then raise exception 'Idempotency key reused with different data' using errcode='22023';end if;
  return old.response;
 end if;
 if s.revision is distinct from (payload->>'expectedRevision')::bigint then raise exception 'Onboarding changed; refresh and retry' using errcode='40001';end if;
 update private.onboarding_sessions set data=data||jsonb_build_object('websiteCompletedAt',coalesce(data->'websiteCompletedAt',to_jsonb(now()))),revision=revision+1,updated_at=now() where user_id=owner_id;
 response:=private.onboarding_view(owner_id);
 insert into private.onboarding_events(user_id,event_key,request,response) values(owner_id,payload->>'eventKey',payload,response);
 return response;
end $$;
revoke all on function private.onboarding_action(uuid,text,jsonb,uuid),private.website_onboarding_previous(uuid,text,jsonb,uuid) from public,anon,authenticated;
commit;
