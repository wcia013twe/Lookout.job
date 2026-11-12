begin;
create table private.circle_avatars(user_id uuid primary key references auth.users(id) on delete cascade, revision integer not null default 1, avatar jsonb not null);
alter table private.circle_avatars enable row level security;
alter table private.circles add column theme_id text not null default 'cloud-cottage', add column appearance_revision integer not null default 0;
alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to appearance_previous_knowledge_action;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare result jsonb; cid uuid; owner_id uuid; current_revision integer; avatar jsonb; image_bytes bytea; width integer; height integer; request private.knowledge_requests;
begin
 if op not in ('circles.avatar','circles.theme','circles.read') then return private.appearance_previous_knowledge_action(actor,op,payload,connection); end if;
 if op='circles.read' then
  result:=private.appearance_previous_knowledge_action(actor,op,payload,connection);
  if result->>'available'='false' then return result; end if;
  cid:=(payload->>'circleId')::uuid;
  return result||jsonb_build_object('appearance',(select jsonb_build_object('themeId',c.theme_id,'revision',c.appearance_revision) from private.circles c where c.id=cid),'members',(select coalesce(jsonb_agg(member||jsonb_build_object('avatar',coalesce(a.avatar,'{"kind":"builtin","id":"alfred"}'::jsonb),'avatarRevision',coalesce(a.revision,0))),'[]'::jsonb) from jsonb_array_elements(result->'members') member left join private.circle_avatars a on a.user_id=(member->>'id')::uuid));
 end if;
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if connection is not null then raise exception 'Human appearance selection required; use the Circle manage handoff' using errcode='42501'; end if;
 if not (select enabled from private.knowledge_config where singleton) then raise exception 'Circles unavailable' using errcode='42501'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>180000 or exists(select 1 from jsonb_object_keys(payload) key where key not in ('circleId','expectedRevision','eventKey',case when op='circles.avatar' then 'avatar' else 'themeId' end)) or jsonb_typeof(payload->'expectedRevision') is distinct from 'number' or (payload->>'expectedRevision')!~'^[0-9]+$' or coalesce(length(payload->>'eventKey'),0) not between 1 and 100 then raise exception 'Invalid appearance arguments' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,41));
 cid:=(payload->>'circleId')::uuid;
 select c.owner_id into owner_id from private.circles c where c.id=cid for update;
 if not found or not exists(select 1 from private.circle_members m where m.circle_id=cid and m.user_id=actor and m.active) then raise exception 'Circle unavailable' using errcode='42501'; end if;
 if op='circles.theme' and owner_id<>actor then raise exception 'Circle owner required' using errcode='42501'; end if;
 select * into request from private.knowledge_requests r where r.user_id=actor and r.event_key=payload->>'eventKey';
 if found then
  if request.operation<>op or request.payload<>payload then raise exception 'Idempotency key changed' using errcode='40001'; end if;
  return request.result;
 end if;
 if (select count(*) from private.knowledge_requests where user_id=actor and created_at>now()-interval '1 hour')>=200 then raise exception 'Circle write limit reached; retry later' using errcode='54000'; end if;
 if op='circles.avatar' then
  avatar:=payload->'avatar';
  if jsonb_typeof(avatar) is distinct from 'object' then raise exception 'Avatar required' using errcode='22023'; end if;
  if avatar->>'kind'='builtin' then
   if coalesce(avatar->>'id','') not in ('alfred','iggy','felipe','todd','jojo') or exists(select 1 from jsonb_object_keys(avatar) key where key not in ('kind','id')) then raise exception 'Invalid avatar' using errcode='22023'; end if;
  else
   if coalesce(avatar->>'kind','') not in ('image','sheet') or exists(select 1 from jsonb_object_keys(avatar) key where key not in ('kind','dataUrl')) or jsonb_typeof(avatar->'dataUrl') is distinct from 'string' or length(avatar->>'dataUrl')>175000 or (avatar->>'dataUrl')!~'^data:image/png;base64,iVBORw0KGgo[A-Za-z0-9+/=]+$' then raise exception 'Transparent PNG required' using errcode='22023'; end if;
   image_bytes:=decode(substr(avatar->>'dataUrl',23),'base64');
   if octet_length(image_bytes) not between 33 and 131072 or encode(substring(image_bytes from 1 for 8),'hex')<>'89504e470d0a1a0a' or encode(substring(image_bytes from 13 for 4),'hex')<>'49484452' then raise exception 'Invalid PNG' using errcode='22023'; end if;
   width:=get_byte(image_bytes,16)*16777216+get_byte(image_bytes,17)*65536+get_byte(image_bytes,18)*256+get_byte(image_bytes,19);
   height:=get_byte(image_bytes,20)*16777216+get_byte(image_bytes,21)*65536+get_byte(image_bytes,22)*256+get_byte(image_bytes,23);
   if get_byte(image_bytes,25) not in (4,6) or (avatar->>'kind'='sheet' and (width<>768 or height<>624)) or (avatar->>'kind'='image' and (width not between 1 and 512 or height not between 1 and 512)) then raise exception 'Invalid avatar geometry or missing alpha channel' using errcode='22023'; end if;
  end if;
  select coalesce((select revision from private.circle_avatars where user_id=actor),0) into current_revision;
  if current_revision<>(payload->>'expectedRevision')::integer then raise exception 'Avatar changed; reload' using errcode='40001'; end if;
  insert into private.circle_avatars(user_id,revision,avatar) values(actor,current_revision+1,avatar) on conflict(user_id) do update set revision=excluded.revision,avatar=excluded.avatar;
 else
  if coalesce(payload->>'themeId','') not in ('cloud-cottage','lamplit-cottage') then raise exception 'Choose a reviewed theme' using errcode='22023'; end if;
  select appearance_revision into current_revision from private.circles where id=cid;
  if current_revision<>(payload->>'expectedRevision')::integer then raise exception 'Theme changed; reload' using errcode='40001'; end if;
  update private.circles set theme_id=payload->>'themeId',appearance_revision=current_revision+1 where id=cid;
 end if;
 result:=jsonb_build_object('revision',current_revision+1);
 insert into private.knowledge_requests(user_id,event_key,operation,payload,result) values(actor,payload->>'eventKey',op,payload,result);
 return result;
end $$;
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.appearance_previous_knowledge_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
commit;
