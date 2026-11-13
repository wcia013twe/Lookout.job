begin;
create sequence private.recommendation_feedback_change_sequence;
revoke all on sequence private.recommendation_feedback_change_sequence from public,anon,authenticated;
create table public.recommendation_feedback (
 user_id uuid not null references auth.users on delete cascade,
 kind text not null check(kind in ('job','network','planning')),
 target_id text not null check(length(target_id) between 1 and 500),
 rating text check(rating in ('helpful','not-helpful')),
 reason text not null default '' check(length(reason)<=200),
 note text not null default '' check(length(note)<=2000),
 version integer not null check(version>0),
 context jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(user_id,kind,target_id)
);
create table private.recommendation_feedback_changes (
 user_id uuid not null references auth.users on delete cascade,
 sequence bigint not null,
 request_id text not null,
 payload jsonb not null,
 response jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,sequence),unique(user_id,request_id)
);
create index recommendation_feedback_write_window on private.recommendation_feedback_changes(user_id,created_at);
alter table public.recommendation_feedback enable row level security;
alter table private.recommendation_feedback_changes enable row level security;
create policy recommendation_feedback_owner_read on public.recommendation_feedback for select to authenticated using(user_id=(select auth.uid()));
create policy recommendation_feedback_changes_owner_read on private.recommendation_feedback_changes for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.recommendation_feedback,private.recommendation_feedback_changes from public,anon,authenticated;
grant select on public.recommendation_feedback to authenticated;
grant all on public.recommendation_feedback,private.recommendation_feedback_changes to service_role;

alter function private.workspace_reset_tables() rename to workspace_reset_tables_before_recommendation_feedback;
create function private.workspace_reset_tables() returns text[] language sql immutable set search_path='' as $$
 select array['public.recommendation_feedback','private.recommendation_feedback_changes']::text[] || private.workspace_reset_tables_before_recommendation_feedback()
$$;
revoke all on function private.workspace_reset_tables(),private.workspace_reset_tables_before_recommendation_feedback() from public,anon,authenticated;
create trigger workspace_reset_guard before insert or update or delete on public.recommendation_feedback for each row execute function private.workspace_reset_write_guard();
create trigger workspace_reset_guard before insert or update or delete on private.recommendation_feedback_changes for each row execute function private.workspace_reset_write_guard();

create function private.recommendation_feedback_target(owner_id uuid,kind_arg text,target_arg text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb; parent_id text; task_id text;
begin
 if kind_arg='job' then
  select jsonb_build_object('batchId',item.batch_id,'recommendation',item.recommendation,'recommendationVersion',batch.created_at)
   into snapshot from public.batch_items item join public.job_batches batch on batch.id=item.batch_id and batch.user_id=item.user_id
   where item.user_id=owner_id and item.job_id=target_arg order by batch.created_at desc,batch.id desc limit 1;
 elsif kind_arg='network' then
  select jsonb_build_object('recommendation',record->'suggestion','recommendationVersion',revision) into snapshot
   from public.outreach_contacts where user_id=owner_id and id=target_arg and deleted_at is null;
 elsif kind_arg='planning' then
  parent_id:=split_part(target_arg,':',2);
  task_id:=substring(target_arg from length(split_part(target_arg,':',1))+length(parent_id)+3);
  if target_arg like 'application:%' then
   select jsonb_build_object('applicationId',application_id,'taskId',task_id,'recommendation',task,'recommendationVersion',version) into snapshot
    from public.preparation_plans cross join lateral jsonb_array_elements(plan->'tasks') task
    where user_id=owner_id and application_id::text=parent_id and task->>'id'=task_id;
  elsif target_arg like 'goal:%' then
   select jsonb_build_object('goalId',id,'taskId',task_id,'recommendation',task,'recommendationVersion',version) into snapshot
    from public.learning_goals cross join lateral jsonb_array_elements(goal->'tasks') task
    where user_id=owner_id and id::text=parent_id and task->>'id'=task_id;
  end if;
 end if;
 if snapshot is null then raise exception 'Owned recommendation target not found' using errcode='42501';end if;
 return snapshot;
end $$;

create function private.recommendation_feedback_row(row_arg public.recommendation_feedback) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('kind',row_arg.kind,'targetId',row_arg.target_id,'rating',row_arg.rating,'reason',row_arg.reason,'note',row_arg.note,'version',row_arg.version,'context',row_arg.context,'updatedAt',row_arg.updated_at)
$$;

create function private.recommendation_feedback_owned(owner_id uuid,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare target jsonb; snapshot jsonb; previous public.recommendation_feedback; saved public.recommendation_feedback; replay private.recommendation_feedback_changes;
 rows_result jsonb:='[]'; response jsonb; sequence_next bigint; cursor_value bigint; page_limit integer; last_sequence bigint;
begin
 if owner_id is null then raise exception 'Sign in required' using errcode='42501';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>65536 then raise exception 'Invalid recommendation feedback' using errcode='22023';end if;
 if operation='recommendation.feedback.list' then
  if payload-array['after','limit']<>'{}'::jsonb or (payload ? 'after' and (jsonb_typeof(payload->'after') is distinct from 'string' or (payload->>'after')!~'^(0|[1-9][0-9]{0,17})$'))
   or (payload ? 'limit' and (jsonb_typeof(payload->'limit') is distinct from 'number' or (payload->>'limit')!~'^[0-9]{1,3}$')) then raise exception 'Invalid feedback cursor or limit' using errcode='22023';end if;
  cursor_value:=coalesce(payload->>'after','0')::bigint;page_limit:=coalesce((payload->>'limit')::integer,100);
  if page_limit not between 1 and 100 then raise exception 'Invalid feedback limit' using errcode='22023';end if;
  select coalesce(jsonb_agg(page.response order by page.sequence),'[]'),max(page.sequence) into rows_result,last_sequence
   from (select changes.response,changes.sequence from private.recommendation_feedback_changes changes where changes.user_id=owner_id and changes.sequence>cursor_value order by changes.sequence limit page_limit) page;
  return jsonb_build_object('rows',rows_result,'cursor',coalesce(last_sequence,cursor_value)::text,'hasMore',exists(select 1 from private.recommendation_feedback_changes where user_id=owner_id and sequence>coalesce(last_sequence,cursor_value)));
 elsif operation='recommendation.feedback.read' then
  if payload-array['targets']<>'{}'::jsonb or jsonb_typeof(payload->'targets') is distinct from 'array' then raise exception 'Invalid feedback targets' using errcode='22023';end if;
  if jsonb_array_length(payload->'targets') not between 1 and 100 then raise exception 'Invalid feedback targets' using errcode='22023';end if;
 elsif operation='recommendation.feedback.save' then
  if not payload ?& array['kind','targetId','rating','expectedVersion','requestId'] or payload-array['kind','targetId','rating','reason','note','expectedVersion','requestId','context']<>'{}'::jsonb
   or (payload->'rating'<>'null'::jsonb and (jsonb_typeof(payload->'rating') is distinct from 'string' or payload->>'rating' not in ('helpful','not-helpful')))
   or jsonb_typeof(payload->'expectedVersion') is distinct from 'number' or (payload->>'expectedVersion')!~'^(0|[1-9][0-9]{0,9})$' or (payload->>'expectedVersion')::bigint>=2147483647
   or jsonb_typeof(payload->'requestId') is distinct from 'string' or length(payload->>'requestId') not between 1 and 200
   or (payload ? 'reason' and (jsonb_typeof(payload->'reason') is distinct from 'string' or length(payload->>'reason')>200))
   or (payload ? 'note' and (jsonb_typeof(payload->'note') is distinct from 'string' or length(payload->>'note')>2000))
   or (payload ? 'context' and (jsonb_typeof(payload->'context') is distinct from 'object' or octet_length((payload->'context')::text)>8192)) then raise exception 'Invalid recommendation feedback' using errcode='22023';end if;
 else raise exception 'Unknown feedback operation' using errcode='22023';end if;
 for target in select value from jsonb_array_elements(case when operation='recommendation.feedback.read' then payload->'targets' else jsonb_build_array(jsonb_build_object('kind',payload->'kind','targetId',payload->'targetId')) end) loop
  if jsonb_typeof(target) is distinct from 'object' or target-array['kind','targetId']<>'{}'::jsonb or jsonb_typeof(target->'kind') is distinct from 'string' or target->>'kind' not in ('job','network','planning') or jsonb_typeof(target->'targetId') is distinct from 'string' or length(target->>'targetId') not between 1 and 500 then raise exception 'Invalid feedback target' using errcode='22023';end if;
  if operation='recommendation.feedback.save' then
   perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
   perform pg_advisory_xact_lock(hashtextextended(owner_id::text,241023));
   select * into replay from private.recommendation_feedback_changes where user_id=owner_id and request_id=payload->>'requestId';
   if found then
    if replay.payload<>payload then raise exception 'Feedback request ID already used' using errcode='22023';end if;
    return replay.response;
   end if;
  end if;
  snapshot:=private.recommendation_feedback_target(owner_id,target->>'kind',target->>'targetId');
  select * into previous from public.recommendation_feedback where user_id=owner_id and kind=target->>'kind' and target_id=target->>'targetId';
  if operation='recommendation.feedback.read' then
   rows_result:=rows_result||jsonb_build_array(case when previous.version is null then target||jsonb_build_object('rating',null,'reason','','note','','version',0,'context',snapshot,'updatedAt',null) else private.recommendation_feedback_row(previous) end);
  else
   if coalesce(previous.version,0)<>(payload->>'expectedVersion')::integer then raise exception 'Feedback changed; reload before saving' using errcode='40001';end if;
   if (select count(*) from private.recommendation_feedback_changes where user_id=owner_id and created_at>clock_timestamp()-interval '1 minute')>=60 then raise exception 'Feedback write limit reached; retry later' using errcode='54000';end if;
   insert into public.recommendation_feedback(user_id,kind,target_id,rating,reason,note,version,context)
    values(owner_id,target->>'kind',target->>'targetId',payload->>'rating',case when payload->>'rating' is null then '' else coalesce(payload->>'reason','') end,case when payload->>'rating' is null then '' else coalesce(payload->>'note','') end,coalesce(previous.version,0)+1,snapshot||jsonb_build_object('supplied',coalesce(payload->'context','{}'::jsonb)))
    on conflict(user_id,kind,target_id) do update set rating=excluded.rating,reason=excluded.reason,note=excluded.note,version=excluded.version,context=excluded.context,updated_at=clock_timestamp() returning * into saved;
   response:=private.recommendation_feedback_row(saved);
   sequence_next:=nextval('private.recommendation_feedback_change_sequence');
   insert into private.recommendation_feedback_changes(user_id,sequence,request_id,payload,response) values(owner_id,sequence_next,payload->>'requestId',payload,response);
   return response;
  end if;
 end loop;
 return jsonb_build_object('rows',rows_result);
end $$;

create function public.recommendation_feedback_action(operation text,payload jsonb) returns jsonb
language sql security definer set search_path='' as $$ select private.recommendation_feedback_owned(auth.uid(),operation,payload) $$;
revoke all on function public.recommendation_feedback_action(text,jsonb) from public,anon;
grant execute on function public.recommendation_feedback_action(text,jsonb) to authenticated;

alter function public.agent_dispatch(text,text,jsonb) rename to agent_dispatch_before_recommendation_feedback;
alter function public.agent_dispatch_before_recommendation_feedback(text,text,jsonb) set schema private;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare connection private.agent_connections;
begin
 if operation not like 'recommendation.feedback.%' then return private.agent_dispatch_before_recommendation_feedback(credential_hash,operation,payload);end if;
 perform private.agent_dispatch_core(credential_hash,'credentials.verify','{}');
 select * into connection from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if connection.user_id is null or not 'workspace:read'=any(connection.scopes) then raise exception 'Feedback scope required' using errcode='42501';end if;
 if operation not in ('recommendation.feedback.read','recommendation.feedback.list') then raise exception 'Human feedback requires authenticated user' using errcode='42501';end if;
 return private.recommendation_feedback_owned(connection.user_id,operation,payload);
end $$;
revoke all on function private.recommendation_feedback_target(uuid,text,text),private.recommendation_feedback_row(public.recommendation_feedback),private.recommendation_feedback_owned(uuid,text,jsonb),private.agent_dispatch_before_recommendation_feedback(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;
commit;
