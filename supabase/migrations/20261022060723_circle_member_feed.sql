begin;

-- Allocate positions while holding the Circle row lock. A rolled-back publish
-- rolls back its position too; a later committed event cannot overtake it.
alter table private.circles add column feed_sequence bigint not null default 0 check(feed_sequence>=0);
create table private.circle_events (
 circle_id uuid not null references private.circles,
 position bigint not null check(position>0),
 id uuid not null default gen_random_uuid() unique,
 post_id uuid not null,
 revision integer not null,
 kind text not null check(kind in ('published','revision_published','withdrawn','hidden')),
 created_at timestamptz not null default clock_timestamp(),
 primary key(circle_id,position),
 unique(post_id,revision,kind),
 foreign key(post_id,revision) references private.knowledge_revisions(post_id,revision)
);
alter table private.circle_events enable row level security;
revoke all on private.circle_events from public,anon,authenticated;

create function private.record_circle_event() returns trigger language plpgsql set search_path='' as $$
declare event_kind text; event_revision integer; next_position bigint;
begin
 if new.state='published' and new.published_revision is not null and
    (old.state<>'published' or old.published_revision is distinct from new.published_revision) then
  event_kind:=case when old.published_revision is null then 'published' else 'revision_published' end;
  event_revision:=new.published_revision;
 elsif old.state='published' and old.published_revision is not null and new.state in ('withdrawn','hidden') then
  event_kind:=new.state;event_revision:=old.published_revision;
 else return new;
 end if;
 update private.circles set feed_sequence=feed_sequence+1 where id=new.circle_id returning feed_sequence into next_position;
 insert into private.circle_events(circle_id,position,post_id,revision,kind) values(new.circle_id,next_position,new.id,event_revision,event_kind);
 return new;
end $$;
revoke all on function private.record_circle_event() from public,anon,authenticated;
create trigger circle_publication_event after update of published_revision,state on private.knowledge_posts
 for each row execute function private.record_circle_event();

-- Feed reads must never substitute an author's newer private draft.
create function private.circle_feed_post(p private.knowledge_posts,actor uuid) returns jsonb language plpgsql stable set search_path='' as $$
begin
 p.current_revision:=p.published_revision;
 return private.knowledge_projection(p,actor);
end $$;
revoke all on function private.circle_feed_post(private.knowledge_posts,uuid) from public,anon,authenticated;

alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to knowledge_before_feed;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql set search_path='' as $$
declare permission jsonb; cid uuid; boundary bigint; start_position bigint:=0; lim integer:=20; items jsonb; cursor jsonb;
begin
 if op<>'knowledge.feed' then return private.knowledge_before_feed(actor,op,payload,connection); end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>24000 or
    exists(select 1 from jsonb_object_keys(payload) k where k not in ('circleId','after','limit')) or
    jsonb_typeof(payload->'circleId') is distinct from 'string' then raise exception 'Invalid feed arguments' using errcode='22023'; end if;
 -- This reuses the release gate, sign-in, Circle and current membership locks.
 permission:=private.knowledge_before_feed(actor,'circles.read',jsonb_build_object('circleId',payload->'circleId'),connection);
 if permission->'available'='false'::jsonb then return permission; end if;
 cid:=(payload->>'circleId')::uuid;
 select feed_sequence into boundary from private.circles where id=cid;
 if payload ? 'limit' then
  if jsonb_typeof(payload->'limit') is distinct from 'number' or (payload->>'limit') !~ '^[0-9]+$' then raise exception 'Invalid feed limit' using errcode='22023'; end if;
  lim:=(payload->>'limit')::integer;
  if lim not between 1 and 50 then raise exception 'Feed limit must be 1 to 50' using errcode='22023'; end if;
 end if;
 if payload ? 'after' then
  cursor:=payload->'after';
  if jsonb_typeof(cursor) is distinct from 'object' then raise exception 'Invalid feed cursor' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(cursor) k where k not in ('version','circleId','position','through')) or
     cursor->'version' is distinct from '1'::jsonb or cursor->'circleId' is distinct from payload->'circleId' or
     jsonb_typeof(cursor->'position') is distinct from 'string' or (cursor->>'position') !~ '^[0-9]{1,18}$' or
     (cursor ? 'through' and (jsonb_typeof(cursor->'through') is distinct from 'string' or (cursor->>'through') !~ '^[0-9]{1,18}$')) then raise exception 'Invalid or mismatched feed cursor' using errcode='22023'; end if;
  start_position:=(cursor->>'position')::bigint;
  if cursor ? 'through' then
   if (cursor->>'through')::bigint>boundary then raise exception 'Feed cursor is ahead of current history' using errcode='22023'; end if;
   boundary:=(cursor->>'through')::bigint;
  end if;
  if start_position>boundary then raise exception 'Feed cursor is ahead of current history' using errcode='22023'; end if;
 end if;
 select coalesce(jsonb_agg(item order by position),'[]'::jsonb) into items from (
  select e.position,jsonb_build_object('id',e.id,'circleId',cid,'position',e.position::text,'kind',e.kind,
   'postId',e.post_id,'threadId',coalesce(p.parent_id,p.id),'revision',e.revision,'createdAt',e.created_at,
   'invalidateThread',e.kind in ('withdrawn','hidden') and p.parent_id is null,
   'sourceAvailable',e.kind in ('published','revision_published') and p.state='published' and p.published_revision=e.revision and
    (p.parent_id is null or exists(select 1 from private.knowledge_posts parent where parent.id=p.parent_id and parent.state='published')),
   'post',case when e.kind in ('published','revision_published') and p.state='published' and p.published_revision=e.revision and
    (p.parent_id is null or exists(select 1 from private.knowledge_posts parent where parent.id=p.parent_id and parent.state='published'))
    then private.circle_feed_post(p,actor) else null end) item
  from private.circle_events e join private.knowledge_posts p on p.id=e.post_id
  where e.circle_id=cid and e.position>start_position and e.position<=boundary order by e.position limit lim+1
 ) page;
 if jsonb_array_length(items)>lim then
  items:=items-lim;
  cursor:=jsonb_build_object('version',1,'circleId',cid,'position',items->-1->>'position','through',boundary::text);
 else cursor:=null; end if;
 return jsonb_build_object('items',items,'nextCursor',cursor,'checkpoint',jsonb_build_object('version',1,'circleId',cid,'position',boundary::text));
end $$;
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.knowledge_before_feed(uuid,text,jsonb,uuid) from public,anon,authenticated;

-- Keep the existing invoker dispatch chain; only the scoped token helper needs
-- privileged private-table access. Browser roles cannot invoke this helper.
create function private.circle_feed_dispatch(credential_hash text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections;
begin
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid credential' using errcode='28000'; end if;
 if not 'knowledge:read'=any(c.scopes) then raise exception 'Knowledge read scope required' using errcode='42501'; end if;
 return private.knowledge_action(c.user_id,'knowledge.feed',payload,c.id);
end $$;
revoke all on function private.circle_feed_dispatch(text,jsonb) from public,anon,authenticated;
grant execute on function private.circle_feed_dispatch(text,jsonb) to service_role;
alter function public.agent_dispatch(text,text,jsonb) set schema private;
alter function private.agent_dispatch(text,text,jsonb) rename to circle_feed_previous_dispatch;
revoke all on function private.circle_feed_previous_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.circle_feed_previous_dispatch(text,text,jsonb) to service_role;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if operation='knowledge.feed' then return private.circle_feed_dispatch(credential_hash,payload); end if;
 return private.circle_feed_previous_dispatch(credential_hash,operation,payload);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

-- Start at future publication events; no invented historical publication dates.
commit;
