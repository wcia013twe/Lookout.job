begin;
create table private.circle_saved_resources (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references private.knowledge_posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
revoke all on private.circle_saved_resources from public,anon,authenticated;
alter function private.knowledge_action(uuid,text,jsonb,uuid) rename to saved_resource_previous_knowledge_action;
create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare result jsonb; post private.knowledge_posts; request private.knowledge_requests; saved boolean;
begin
 if op not in ('knowledge.read','knowledge.save_resource') then return private.saved_resource_previous_knowledge_action(actor,op,payload,connection); end if;
 if op='knowledge.read' then
  result:=private.saved_resource_previous_knowledge_action(actor,op,payload,connection);
  if result ? 'post' then
   result:=jsonb_set(result,'{post}',(result->'post')||jsonb_build_object('saved',exists(select 1 from private.circle_saved_resources s where s.user_id=actor and s.post_id=(result->'post'->>'id')::uuid)));
  end if;
  return result;
 end if;
 if actor is null or jsonb_typeof(payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('circleId','postId','saved','expectedSaved','eventKey')) or jsonb_typeof(payload->'circleId') is distinct from 'string' or jsonb_typeof(payload->'postId') is distinct from 'string' or jsonb_typeof(payload->'saved') is distinct from 'boolean' or jsonb_typeof(payload->'expectedSaved') is distinct from 'boolean' or jsonb_typeof(payload->'eventKey') is distinct from 'string' or length(payload->>'eventKey') not between 1 and 100 or octet_length(payload::text)>24000 then raise exception 'Invalid saved resource' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,41));
 result:=private.saved_resource_previous_knowledge_action(actor,'knowledge.read',jsonb_build_object('circleId',payload->'circleId','postId',payload->'postId'),connection);
 if result->>'available'='false' then return result; end if;
 select * into post from private.knowledge_posts p where p.id=(payload->>'postId')::uuid and p.circle_id=(payload->>'circleId')::uuid for update;
 if not found or post.state<>'published' or post.parent_id is not null or not exists(select 1 from private.knowledge_revisions r where r.post_id=post.id and r.revision=post.published_revision and r.content->>'type'='resource') then raise exception 'Resource unavailable' using errcode='42501'; end if;
 select exists(select 1 from private.circle_saved_resources s where s.user_id=actor and s.post_id=post.id) into saved;
 select * into request from private.knowledge_requests r where r.user_id=actor and r.event_key=payload->>'eventKey';
 if found then
  if request.operation<>op or request.payload<>payload or saved is distinct from (request.result->>'saved')::boolean then raise exception 'Saved resource changed' using errcode='40001'; end if;
  return request.result;
 end if;
 if saved is distinct from (payload->>'expectedSaved')::boolean then raise exception 'Saved resource changed' using errcode='40001'; end if;
 if (payload->>'saved')::boolean then insert into private.circle_saved_resources(user_id,post_id) values(actor,post.id) on conflict do nothing;
 else delete from private.circle_saved_resources s where s.user_id=actor and s.post_id=post.id; end if;
 result:=jsonb_build_object('saved',(payload->>'saved')::boolean);
 insert into private.knowledge_requests(user_id,event_key,operation,payload,result) values(actor,payload->>'eventKey',op,payload,result);
 return result;
end $$;
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.saved_resource_previous_knowledge_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
commit;
