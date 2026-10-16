begin;

create or replace function private.validate_knowledge_content(content jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(content) is distinct from 'object' then raise exception 'Content object required' using errcode='22023'; end if;
 if content::text ~* '(storage/v1/object/(sign|authenticated)/|[?&](token|access_token|apikey|api_key|signature|x-amz-signature)=|mail[.]google[.]com/|outlook[.]office[.]com/mail/)' then raise exception 'Private sources and signed file links cannot be shared' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(content) k where k not in ('title','body','type','company','role','stage','experienceDate','sources','provenance','uncertainty','personalDisclosure','insight','jobUrl','jobId','offers','contexts'))
 or coalesce(content->>'type','') not in ('interview_report','timeline','resource','opportunity','milestone','reply','discussion','offer_comparison')
 or coalesce(length(trim(content->>'title')),0) not between 1 and 200
 or jsonb_typeof(content->'body') is distinct from 'string' or length(content->>'body')>12000
 or (coalesce(length(trim(content->>'body')),0)=0 and coalesce(length(trim(content->>'insight')),0)=0)
 or (content->>'type'='reply' and coalesce(length(trim(content->>'body')),0)=0)
 or length(coalesce(content->>'insight',''))>4000
 or (content->>'jobUrl' is not null and (content->>'jobUrl' !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or length(content->>'jobUrl')>2000))
 or coalesce(content->>'provenance','') not in ('employer_verified','user_confirmed','agent_observed','agent_inferred','unknown')
 or jsonb_typeof(content->'personalDisclosure') is distinct from 'boolean'
 or length(coalesce(content->>'uncertainty',''))>1000 then raise exception 'Invalid knowledge content' using errcode='22023'; end if;
 if jsonb_typeof(content->'sources') is distinct from 'array' then raise exception 'Sources array required' using errcode='22023'; end if;
 if jsonb_array_length(content->'sources')>10 then raise exception 'Too many sources' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(content->'sources') s where jsonb_typeof(s) is distinct from 'object') then raise exception 'Source objects required' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(content->'sources') s where exists(select 1 from jsonb_object_keys(s) k where k not in ('url','label')) or jsonb_typeof(s->'url') is distinct from 'string' or jsonb_typeof(s->'label') is distinct from 'string' or coalesce(s->>'url','') !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or length(s->>'url')>2000 or coalesce(length(s->>'label'),0) not between 1 and 200) then raise exception 'Sources must be labeled public HTTPS references' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(content) e where e.key in ('title','body','type','company','role','stage','experienceDate','provenance','uncertainty','insight','jobUrl','jobId') and jsonb_typeof(e.value) not in ('string','null')) or exists(select 1 from jsonb_each_text(content) e where e.key in ('company','role','stage','jobId') and length(e.value)>200) then raise exception 'Invalid knowledge fields' using errcode='22023'; end if;
 if content ? 'jobId' and content->>'jobId' is not null and length(trim(content->>'jobId'))=0 then raise exception 'Job ID required when attached' using errcode='22023'; end if;
 if content ? 'offers' or content->>'type'='offer_comparison' then
  if content->>'type'<>'offer_comparison' or jsonb_typeof(content->'offers') is distinct from 'array' then raise exception 'Offer comparison array required' using errcode='22023'; end if;
  if jsonb_array_length(content->'offers') not between 2 and 4 then raise exception 'Attach two to four offers' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(content->'offers') o where jsonb_typeof(o) is distinct from 'object') then raise exception 'Offer objects required' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(content->'offers') o where jsonb_typeof(o->'company') is distinct from 'string' or coalesce(length(trim(o->>'company')),0)=0 or exists(select 1 from jsonb_each(o) e where e.key not in ('company','role','location','base','equity','signOn','notes') or jsonb_typeof(e.value) is distinct from 'string' or length(e.value#>>'{}')>case when e.key='notes' then 1000 else 200 end)) then raise exception 'Invalid offer details' using errcode='22023'; end if;
 end if;
 if content ? 'contexts' then
  if jsonb_typeof(content->'contexts') is distinct from 'array' then raise exception 'Context array required' using errcode='22023'; end if;
  if jsonb_array_length(content->'contexts')>6 then raise exception 'Attach up to six contexts' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(content->'contexts') a where jsonb_typeof(a) is distinct from 'object') then raise exception 'Context objects required' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(content->'contexts') a where coalesce(a->>'kind','') not in ('application','referral','resource','note') or coalesce(length(trim(a->>'label')),0) not between 1 and 200 or exists(select 1 from jsonb_each(a) e where not e.key=any(case a->>'kind' when 'application' then array['kind','label','company','role','jobId','jobUrl','stage'] when 'referral' then array['kind','label','company','role','contact','url'] when 'resource' then array['kind','label','url'] when 'note' then array['kind','label','note'] else array[]::text[] end) or jsonb_typeof(e.value) is distinct from 'string' or length(e.value#>>'{}')>case when e.key in ('jobUrl','url') then 2000 when e.key='note' then 1000 else 200 end)) then raise exception 'Invalid context fields' using errcode='22023'; end if;
  if exists(select 1 from jsonb_array_elements(content->'contexts') a cross join lateral jsonb_each_text(a) e where e.key in ('jobUrl','url') and e.value<>'' and e.value !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$') then raise exception 'Public HTTPS context links required' using errcode='22023'; end if;
 end if;
 if content->>'experienceDate' is not null then
  if content->>'experienceDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'ISO experience date required' using errcode='22023'; end if;
  perform (content->>'experienceDate')::date;
 end if;
end $$;

alter table private.knowledge_revisions drop column search_document;
alter table private.knowledge_revisions add column search_document tsvector generated always as (to_tsvector('english',coalesce(content->>'title','')||' '||coalesce(content->>'body','')||' '||coalesce(content->>'insight','')||' '||coalesce(content->>'company','')||' '||coalesce(content->>'role','')||' '||coalesce(content->>'jobId','')||' '||coalesce(content->>'stage','')||' '||coalesce(content->'offers','[]'::jsonb)::text||' '||coalesce(content->'contexts','[]'::jsonb)::text)) stored;
create index knowledge_search on private.knowledge_revisions using gin(search_document);

create or replace function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql set search_path='' as $$
#variable_conflict use_variable
declare cid uuid; c private.circles; m private.circle_members; p private.knowledge_posts; parent private.knowledge_posts; inv private.circle_invites; req private.knowledge_requests; content jsonb; output jsonb; rid uuid; v integer; human boolean:=connection is null; event_key text:=payload->>'eventKey'; lim integer; q tsquery; after_time timestamptz; after_id uuid; after_rank real; is_read boolean; allowed text[]; keys text[];
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not (select enabled from private.knowledge_config where singleton) then return jsonb_build_object('available',false,'reason','Circle Knowledge awaits hosted permission verification.'); end if;
 is_read:=op in ('circles.list','circles.read','knowledge.search','knowledge.read','knowledge.citations','knowledge.handoff');
 keys:=case op
 when 'circles.list' then array[]::text[] when 'circles.create' then array['name','alias','eventKey'] when 'circles.join' then array['token','alias','eventKey']
 when 'circles.read' then array['circleId'] when 'circles.invite' then array['circleId','eventKey'] when 'circles.revoke_invite' then array['circleId','inviteId','eventKey']
 when 'circles.leave' then array['circleId','eventKey'] when 'circles.remove' then array['circleId','memberId','eventKey'] when 'circles.policy' then array['circleId','allowedTypes','eventKey']
 when 'knowledge.handoff' then array['circleId','postId','action']
 when 'knowledge.search' then array['circleId','query','company','role','type','stage','since','until','sort','cursor','limit']
 when 'knowledge.read' then array['circleId','postId','cursor','limit'] when 'knowledge.propose' then array['circleId','postId','parentId','expectedRevision','content','sourceEventId','eventKey']
 when 'knowledge.approve' then array['circleId','postId','expectedRevision','eventKey'] when 'knowledge.publish' then array['circleId','postId','expectedRevision','eventKey']
 when 'knowledge.withdraw' then array['circleId','postId','expectedRevision','eventKey'] when 'knowledge.report' then array['circleId','postId','reason','eventKey'] when 'knowledge.hide' then array['circleId','postId','eventKey']
 when 'knowledge.cite' then array['circleId','postId','revision','category','reference','eventKey'] when 'knowledge.retract' then array['circleId','postId','revision','eventKey'] when 'knowledge.citations' then array['circleId','cursor','limit'] else null end;
 if keys is null or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>24000 or exists(select 1 from jsonb_object_keys(payload) k where not k=any(keys)) then raise exception 'Unknown knowledge argument or operation' using errcode='22023'; end if;
 if not human and op in ('circles.create','circles.join','circles.invite','circles.revoke_invite','circles.leave','circles.remove','circles.policy','knowledge.approve','knowledge.hide') then raise exception 'Human action required' using errcode='42501'; end if;
 -- Actor lock covers idempotency/rate limits; Circle lock serializes permissions,
 -- membership changes, publication and counts against concurrent writes.
 if not is_read then
  perform pg_advisory_xact_lock(hashtextextended(actor::text,41));
  if coalesce(length(event_key),0) not between 1 and 100 then raise exception 'eventKey required' using errcode='22023'; end if;
  select * into req from private.knowledge_requests r where r.user_id=actor and r.event_key=event_key;
  if found and (req.operation<>op or req.payload<>payload) then raise exception 'Idempotency key changed' using errcode='40001'; end if;
  if req.event_key is null and not (human and op in ('circles.policy','circles.revoke_invite','circles.remove','circles.leave','knowledge.withdraw','knowledge.hide','knowledge.retract')) and (select count(*) from private.knowledge_requests where user_id=actor and created_at>now()-interval '1 hour')>=200 then raise exception 'Circle write limit reached; retry later' using errcode='54000'; end if;
 end if;
 if op='circles.list' then return jsonb_build_object('available',true,'circles',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'owner',a.owner_id=actor) order by a.created_at),'[]') from private.circles a join private.circle_members b on b.circle_id=a.id where b.user_id=actor and b.active)); end if;
 if op='circles.create' then
  if req.event_key is not null then cid:=(req.result->>'circleId')::uuid; else
   insert into private.circles(name,owner_id) values(trim(payload->>'name'),actor) returning id into cid;
   insert into private.circle_members(circle_id,user_id,alias) values(cid,actor,trim(payload->>'alias'));
  end if;
 elsif op='circles.join' then
  select * into inv from private.circle_invites where token=(payload->>'token')::uuid;
  if not found then raise exception 'Invite unavailable' using errcode='P0002'; end if; cid:=inv.circle_id;
 else cid:=(payload->>'circleId')::uuid; end if;
 if is_read then select * into c from private.circles where id=cid for share;
 else select * into c from private.circles where id=cid for update; end if;
 if not found then raise exception 'Circle unavailable' using errcode='P0002'; end if;
 if op='circles.join' then
  select * into inv from private.circle_invites where id=inv.id for update;
  if inv.revoked_at is not null or inv.expires_at<=now() then raise exception 'Invite unavailable' using errcode='42501'; end if;
  if req.event_key is null then
   if exists(select 1 from private.circle_members where circle_id=cid and user_id=actor and not active and access_revoked_at>=inv.created_at) then raise exception 'Membership removed; ask for an invite created after removal' using errcode='42501'; end if;
   insert into private.circle_members(circle_id,user_id,alias) values(cid,actor,trim(payload->>'alias')) on conflict(circle_id,user_id) do update set active=true,access_revoked_at=null,alias=excluded.alias,allowed_types='{}';
  end if;
 end if;
 if is_read then select * into m from private.circle_members where circle_id=cid and user_id=actor and active for share;
 else select * into m from private.circle_members where circle_id=cid and user_id=actor and active for update; end if;
 if not found then raise exception 'Circle unavailable' using errcode='42501'; end if;
 -- Recheck membership before replay; cached results contain only identifiers.
 if req.event_key is not null then
  if req.result ? 'postId' and exists(select 1 from private.knowledge_posts a where a.id=(req.result->>'postId')::uuid and (a.state in ('withdrawn','hidden') or a.parent_id is not null and not exists(select 1 from private.knowledge_posts b where b.id=a.parent_id and b.state='published'))) then return jsonb_build_object('unavailable',true); end if;
  if op='circles.invite' and not exists(select 1 from private.circle_invites where id=(req.result->>'inviteId')::uuid and revoked_at is null and expires_at>now()) then return jsonb_build_object('unavailable',true); end if;
  return req.result;
 end if;
 if op in ('circles.create','circles.join') then output:=jsonb_build_object('circleId',cid);
 elsif op='circles.read' then
  return jsonb_build_object('circle',jsonb_build_object('id',cid,'name',c.name,'owner',c.owner_id=actor),'policy',m.allowed_types,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'alias',alias,'owner',user_id=c.owner_id,'self',user_id=actor)),'[]') from private.circle_members where circle_id=cid and active),'invites',case when human and c.owner_id=actor then (select coalesce(jsonb_agg(to_jsonb(i)-'circle_id'),'[]') from private.circle_invites i where circle_id=cid and revoked_at is null and expires_at>now()) else '[]' end,'reports',case when c.owner_id=actor then (select coalesce(jsonb_agg(jsonb_build_object('postId',r.post_id,'reason',r.reason,'id',r.id)),'[]') from private.knowledge_reports r join private.knowledge_posts a on a.id=r.post_id where a.circle_id=cid and a.state='published') else '[]' end);
 elsif op in ('circles.invite','circles.revoke_invite','circles.remove') then
  if c.owner_id<>actor then raise exception 'Circle owner required' using errcode='42501'; end if;
  if op='circles.invite' then insert into private.circle_invites(circle_id) values(cid) returning * into inv; output:=jsonb_build_object('inviteId',inv.id,'token',inv.token,'expiresAt',inv.expires_at);
  elsif op='circles.revoke_invite' then update private.circle_invites set revoked_at=now() where id=(payload->>'inviteId')::uuid and circle_id=cid; output:='{"revoked":true}';
  else
   if (payload->>'memberId')::uuid=c.owner_id then raise exception 'Owner cannot be removed' using errcode='22023'; end if;
   update private.circle_members set active=false,access_revoked_at=now(),allowed_types='{}' where circle_id=cid and user_id=(payload->>'memberId')::uuid;
   delete from private.knowledge_approvals a using private.knowledge_posts b where a.post_id=b.id and b.circle_id=cid and a.user_id=(payload->>'memberId')::uuid; output:='{"removed":true}';
  end if;
 elsif op='circles.leave' then
  if c.owner_id=actor then raise exception 'Owner must keep Circle membership' using errcode='22023'; end if;
  update private.circle_members set active=false,access_revoked_at=now(),allowed_types='{}' where circle_id=cid and user_id=actor;
  delete from private.knowledge_approvals a using private.knowledge_posts b where a.post_id=b.id and b.circle_id=cid and a.user_id=actor; output:='{"left":true}';
 elsif op='circles.policy' then
  if jsonb_typeof(payload->'allowedTypes') is distinct from 'array' then raise exception 'Types required' using errcode='22023'; end if;
  allowed:=array(select jsonb_array_elements_text(payload->'allowedTypes'));
  if not allowed <@ array['resource','opportunity'] then raise exception 'Only closed public resource/opportunity templates support standing permission' using errcode='22023'; end if;
  update private.circle_members set allowed_types=allowed where circle_id=cid and user_id=actor; output:=jsonb_build_object('allowedTypes',allowed);
 elsif op='knowledge.handoff' then
  if coalesce(payload->>'action','') not in ('manage','approve','sharing','moderate') then raise exception 'Invalid handoff' using errcode='22023'; end if;
  if payload->>'postId' is not null and not exists(select 1 from private.knowledge_posts where id=(payload->>'postId')::uuid and circle_id=cid and state not in ('hidden','withdrawn') and (state='published' or author_id=actor)) then raise exception 'Post unavailable' using errcode='P0002'; end if;
  return jsonb_build_object('humanActionRequired',true,'action',payload->>'action','url','https://wcia013twe.github.io/codex-automated-job-board/circles/?circle='||cid||case when payload->>'postId' is null then '' else '&thread='||(payload->>'postId') end);
 elsif op='knowledge.search' then
  lim:=least(50,greatest(1,coalesce((payload->>'limit')::integer,20))); q:=websearch_to_tsquery('english',left(coalesce(payload->>'query',''),500));
  after_time:=(payload->'cursor'->>'createdAt')::timestamptz; after_id:=(payload->'cursor'->>'id')::uuid; after_rank:=(payload->'cursor'->>'rank')::real;
  select coalesce(jsonb_agg(item order by score desc,created_at desc,id desc),'[]') into output from (
   select private.knowledge_projection(a,actor)||jsonb_build_object('rank',case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end) item,a.created_at,a.id,case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end score
   from private.knowledge_posts a join private.knowledge_revisions b on b.post_id=a.id and b.revision=case when a.author_id=actor then a.current_revision else a.published_revision end
   where a.circle_id=cid and a.parent_id is null and a.state not in ('withdrawn','hidden') and (a.state='published' or a.author_id=actor)
   and (coalesce(payload->>'query','')='' or b.search_document@@q)
   and (payload->>'company' is null or lower(b.content->>'company')=lower(payload->>'company')) and (payload->>'role' is null or lower(b.content->>'role')=lower(payload->>'role'))
   and (payload->>'type' is null or b.content->>'type'=payload->>'type') and (payload->>'stage' is null or lower(b.content->>'stage')=lower(payload->>'stage'))
   and (payload->>'since' is null or (b.content->>'experienceDate')::date>=(payload->>'since')::date) and (payload->>'until' is null or (b.content->>'experienceDate')::date<=(payload->>'until')::date)
   and (after_time is null or (case when payload->>'sort'='relevance' then ts_rank(b.search_document,q) else 0 end,a.created_at,a.id)<(coalesce(after_rank,0),after_time,after_id))
   order by score desc,a.created_at desc,a.id desc limit lim
  ) page;
  return jsonb_build_object('items',output,'nextCursor',case when jsonb_array_length(output)=lim then jsonb_build_object('createdAt',output->-1->>'createdAt','id',output->-1->>'id','rank',output->-1->'rank') else null end);
 elsif op='knowledge.citations' then
  lim:=least(50,greatest(1,coalesce((payload->>'limit')::integer,20)));
  select coalesce(jsonb_agg(x order by created_at desc,id desc),'[]') into output from (select a.id,a.post_id,a.revision,a.category,a.reference,a.created_at,a.retracted_at,(source_post.state='published' and (source_post.parent_id is null or exists(select 1 from private.knowledge_posts parent where parent.id=source_post.parent_id and parent.state='published'))) as source_available from private.knowledge_citations a join private.knowledge_posts source_post on source_post.id=a.post_id where a.user_id=actor and source_post.circle_id=cid and (payload->'cursor'->>'createdAt' is null or (a.created_at,a.id)<((payload->'cursor'->>'createdAt')::timestamptz,(payload->'cursor'->>'id')::uuid)) order by a.created_at desc,a.id desc limit lim) x;
  return jsonb_build_object('items',output,'nextCursor',case when jsonb_array_length(output)=lim then jsonb_build_object('createdAt',output->-1->>'created_at','id',output->-1->>'id') else null end);
 elsif op='knowledge.propose' then
  content:=payload->'content'; perform private.validate_knowledge_content(content);
  if content->>'provenance'='user_confirmed' and not human then raise exception 'Agents cannot confirm human facts' using errcode='42501'; end if;
  if content->>'provenance'='employer_verified' and jsonb_array_length(content->'sources')=0 then raise exception 'Employer source required' using errcode='22023'; end if;
  if payload->>'postId' is null then
   if coalesce((payload->>'expectedRevision')::integer,-1)<>0 then raise exception 'New post revision is zero' using errcode='40001'; end if;
   if payload->>'parentId' is not null then
    select * into parent from private.knowledge_posts where id=(payload->>'parentId')::uuid and circle_id=cid and parent_id is null and state='published' for update;
    if not found or content->>'type'<>'reply' then raise exception 'Published thread required' using errcode='42501'; end if;
   elsif content->>'type'='reply' then raise exception 'Reply parent required' using errcode='22023'; end if;
   if not human and content->>'type'='milestone' and payload->>'sourceEventId' is null then raise exception 'Owned milestone source required' using errcode='42501'; end if;
   if payload->>'sourceEventId' is not null and (content->>'type'<>'milestone' or not exists(select 1 from public.application_milestones where id=(payload->>'sourceEventId')::uuid and user_id=actor)) then raise exception 'Owned milestone source required' using errcode='42501'; end if;
   insert into private.knowledge_posts(circle_id,author_id,parent_id,source_event_id) values(cid,actor,parent.id,(payload->>'sourceEventId')::uuid) returning * into p; v:=1;
  else
   if payload ? 'parentId' or payload ? 'sourceEventId' then raise exception 'Thread and source are immutable' using errcode='22023'; end if;
   select * into p from private.knowledge_posts where id=(payload->>'postId')::uuid and circle_id=cid and author_id=actor and state not in ('withdrawn','hidden') for update;
   if not found then raise exception 'Owned post unavailable' using errcode='42501'; end if;
   if p.current_revision<>(payload->>'expectedRevision')::integer or payload->>'expectedRevision' is null then raise exception 'Post changed; reload' using errcode='40001'; end if;
   if (p.parent_id is not null)<>(content->>'type'='reply') or (p.source_event_id is not null and content->>'type'<>'milestone') then raise exception 'Cannot change thread structure' using errcode='22023'; end if;
   if p.parent_id is not null and not exists(select 1 from private.knowledge_posts where id=p.parent_id and state='published') then raise exception 'Thread unavailable' using errcode='42501'; end if;
   v:=p.current_revision+1; update private.knowledge_posts set current_revision=v where id=p.id;
  end if;
  insert into private.knowledge_revisions(post_id,revision,content,connection_id) values(p.id,v,content,connection);
  output:=jsonb_build_object('postId',p.id,'revision',v);
 else
  select * into p from private.knowledge_posts where id=(payload->>'postId')::uuid and circle_id=cid and state not in ('withdrawn','hidden') for update;
  -- Retracting one's receipt remains possible when the source has been removed.
  if op='knowledge.retract' then
   update private.knowledge_citations a set retracted_at=now() from private.knowledge_posts b where a.post_id=b.id and b.circle_id=cid and a.post_id=(payload->>'postId')::uuid and a.revision=(payload->>'revision')::integer and a.user_id=actor returning a.id into rid;
   output:=jsonb_build_object('postId',payload->>'postId','receiptId',rid);
  else
   if not found or (p.state<>'published' and p.author_id<>actor) then raise exception 'Post unavailable' using errcode='P0002'; end if;
   if p.parent_id is not null and not exists(select 1 from private.knowledge_posts where id=p.parent_id and state='published') then raise exception 'Thread unavailable' using errcode='P0002'; end if;
   if op='knowledge.read' then
    lim:=least(50,greatest(1,coalesce((payload->>'limit')::integer,20)));
    select coalesce(jsonb_agg(private.knowledge_projection(a,actor) order by a.created_at,a.id),'[]') into output from (select * from private.knowledge_posts where parent_id=p.id and state not in ('withdrawn','hidden') and (state='published' or author_id=actor) and (payload->'cursor'->>'createdAt' is null or (created_at,id)>((payload->'cursor'->>'createdAt')::timestamptz,(payload->'cursor'->>'id')::uuid)) order by created_at,id limit lim) a;
    return jsonb_build_object('post',private.knowledge_projection(p,actor),'replies',output,'nextCursor',case when jsonb_array_length(output)=lim then jsonb_build_object('createdAt',output->-1->>'createdAt','id',output->-1->>'id') else null end);
   elsif op in ('knowledge.approve','knowledge.publish','knowledge.withdraw') then
    if p.author_id<>actor then raise exception 'Author required' using errcode='42501'; end if;
    if p.current_revision<>(payload->>'expectedRevision')::integer or payload->>'expectedRevision' is null then raise exception 'Post changed; reload' using errcode='40001'; end if;
    select r.content into content from private.knowledge_revisions r where post_id=p.id and revision=p.current_revision;
    if op='knowledge.approve' then insert into private.knowledge_approvals values(p.id,p.current_revision,actor,now()) on conflict do nothing;
    elsif op='knowledge.withdraw' then update private.knowledge_posts set state='withdrawn' where id=p.id;
    else
     if not human and not exists(select 1 from private.knowledge_approvals where post_id=p.id and revision=p.current_revision and user_id=actor) then
      -- A regex cannot prove arbitrary prose contains no private disclosures.
      -- Standing permission is limited to a closed template and public docs URLs.
      if not (content->>'type'=any(m.allowed_types)) or content->>'type' not in ('resource','opportunity') or (content->>'personalDisclosure')::boolean or content->>'provenance'<>'agent_observed' or content->>'company' is not null or content->>'role' is not null or content->>'stage' is not null or content->>'experienceDate' is not null or content->>'uncertainty' is not null or content->>'insight' is not null or content->>'jobUrl' is not null or content->>'jobId' is not null or content ? 'offers' or content ? 'contexts' or content->>'title'<>'Shared public resource' or content->>'body'<>'A public resource to evaluate independently.' or jsonb_array_length(content->'sources')<>1 or content->'sources'->0->>'label'<>'Public source' or content->'sources'->0->>'url' !~ '^https://(www[.])?(postgresql[.]org/docs/|docs[.]python[.]org/|developer[.]mozilla[.]org/|supabase[.]com/docs/)[a-zA-Z0-9/_.-]*$' then raise exception 'Exact human review required for freeform or personal content' using errcode='42501'; end if;
     end if;
     update private.knowledge_posts set state='published',published_revision=p.current_revision where id=p.id;
    end if;
    output:=jsonb_build_object('postId',p.id,'revision',p.current_revision,'action',op);
   elsif op='knowledge.hide' then
    if c.owner_id<>actor or not exists(select 1 from private.knowledge_reports where post_id=p.id) then raise exception 'Owner and report required' using errcode='42501'; end if;
    update private.knowledge_posts set state='hidden' where id=p.id; output:=jsonb_build_object('postId',p.id,'hidden',true);
   elsif op='knowledge.report' then
    if p.state<>'published' then raise exception 'Published post required' using errcode='42501'; end if;
    insert into private.knowledge_reports(post_id,user_id,reason) values(p.id,actor,trim(payload->>'reason')) on conflict(post_id,user_id) do update set reason=excluded.reason; output:=jsonb_build_object('postId',p.id,'reported',true);
   elsif op='knowledge.cite' then
    v:=(payload->>'revision')::integer;
    if human then raise exception 'Agent usage must be reported by an agent' using errcode='42501'; end if;
    if p.author_id=actor or p.state<>'published' or p.published_revision<>v then raise exception 'Current published revision from another author required' using errcode='42501'; end if;
    insert into private.knowledge_citations(post_id,revision,user_id,connection_id,category,reference) values(p.id,v,actor,connection,payload->>'category',payload->>'reference') on conflict(post_id,revision,user_id) do update set retracted_at=null returning id into rid;
    output:=jsonb_build_object('postId',p.id,'receiptId',rid);
   end if;
  end if;
 end if;
 if output is null then raise exception 'Unsupported action' using errcode='22023'; end if;
 insert into private.knowledge_requests(user_id,event_key,operation,payload,result) values(actor,event_key,op,payload,output);
 return output;
end $$;

commit;
