begin;
-- Release gate: enable only after hosted two-account verification.
create table private.knowledge_config(singleton boolean primary key check(singleton), enabled boolean not null default false);
insert into private.knowledge_config values(true,false);
create table private.circles(id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100), owner_id uuid not null references auth.users, created_at timestamptz not null default now());
create table private.circle_members(circle_id uuid references private.circles on delete cascade, user_id uuid references auth.users on delete cascade, alias text not null check(length(trim(alias)) between 1 and 80), active boolean not null default true, access_revoked_at timestamptz, allowed_types text[] not null default '{}', primary key(circle_id,user_id));
create index circle_members_user on private.circle_members(user_id,circle_id) where active;
create table private.circle_invites(id uuid primary key default gen_random_uuid(),circle_id uuid not null references private.circles, token uuid unique not null default gen_random_uuid(), created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz);
create index circle_invites_circle on private.circle_invites(circle_id);
create table private.knowledge_posts(id uuid primary key default gen_random_uuid(), circle_id uuid not null references private.circles, author_id uuid not null references auth.users, parent_id uuid references private.knowledge_posts, current_revision integer not null default 1, published_revision integer, state text not null default 'draft' check(state in ('draft','published','withdrawn','hidden')), source_event_id uuid, created_at timestamptz not null default now());
create unique index knowledge_milestone_once on private.knowledge_posts(circle_id,author_id,source_event_id) where source_event_id is not null;
create index knowledge_circle_feed on private.knowledge_posts(circle_id,created_at desc,id desc);
create index knowledge_replies on private.knowledge_posts(parent_id,created_at,id);
create table private.knowledge_revisions(post_id uuid references private.knowledge_posts on delete cascade, revision integer not null, content jsonb not null, connection_id uuid references private.agent_connections, created_at timestamptz not null default now(), search_document tsvector generated always as (to_tsvector('english',coalesce(content->>'title','')||' '||coalesce(content->>'body','')||' '||coalesce(content->>'company','')||' '||coalesce(content->>'role',''))) stored, primary key(post_id,revision));
create index knowledge_search on private.knowledge_revisions using gin(search_document);
create table private.knowledge_approvals(post_id uuid,revision integer,user_id uuid not null references auth.users,approved_at timestamptz not null default now(),primary key(post_id,revision),foreign key(post_id,revision) references private.knowledge_revisions);
create table private.knowledge_citations(id uuid primary key default gen_random_uuid(),post_id uuid not null,revision integer not null,user_id uuid not null references auth.users,connection_id uuid references private.agent_connections,category text not null check(category in ('answer','preparation_plan')), reference text not null check(reference ~ '^[a-zA-Z0-9_-]{1,100}$'),created_at timestamptz not null default now(),retracted_at timestamptz,unique(post_id,revision,user_id),foreign key(post_id,revision) references private.knowledge_revisions);
create index knowledge_citation_history on private.knowledge_citations(user_id,created_at desc,id desc);
create table private.knowledge_reports(id uuid primary key default gen_random_uuid(),post_id uuid references private.knowledge_posts,user_id uuid references auth.users,reason text not null check(length(trim(reason)) between 1 and 1000),created_at timestamptz not null default now(),unique(post_id,user_id));
create table private.knowledge_requests(user_id uuid references auth.users,event_key text not null,operation text not null,payload jsonb not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,event_key));
create index knowledge_request_limit on private.knowledge_requests(user_id,created_at);
-- RLS is defense in depth; no browser/agent direct-table grants. Checked functions
-- are the only API. Search and counts operate only after current membership checks.
do $$declare t text; begin foreach t in array array['knowledge_config','circles','circle_members','circle_invites','knowledge_posts','knowledge_revisions','knowledge_approvals','knowledge_citations','knowledge_reports','knowledge_requests'] loop execute format('alter table private.%I enable row level security',t); execute format('revoke all on private.%I from public,anon,authenticated',t); end loop; end $$;

create function private.validate_knowledge_content(content jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(content) is distinct from 'object' then raise exception 'Content object required' using errcode='22023'; end if;
 if content::text ~* '(storage/v1/object/(sign|authenticated)/|[?&](token|access_token|apikey|api_key|signature|x-amz-signature)=|mail[.]google[.]com/|outlook[.]office[.]com/mail/)' then raise exception 'Private sources and signed file links cannot be shared' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(content) k where k not in ('title','body','type','company','role','stage','experienceDate','sources','provenance','uncertainty','personalDisclosure'))
 or coalesce(content->>'type','') not in ('interview_report','timeline','resource','opportunity','milestone','reply')
 or coalesce(length(trim(content->>'title')),0) not between 1 and 200 or coalesce(length(trim(content->>'body')),0) not between 1 and 12000
 or coalesce(content->>'provenance','') not in ('employer_verified','user_confirmed','agent_observed','agent_inferred','unknown')
 or jsonb_typeof(content->'personalDisclosure') is distinct from 'boolean'
 or length(coalesce(content->>'uncertainty',''))>1000 then raise exception 'Invalid knowledge content' using errcode='22023'; end if;
 if jsonb_typeof(content->'sources') is distinct from 'array' then raise exception 'Sources array required' using errcode='22023'; end if;
 if jsonb_array_length(content->'sources')>10 then raise exception 'Too many sources' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(content->'sources') s where jsonb_typeof(s) is distinct from 'object') then raise exception 'Source objects required' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(content->'sources') s where exists(select 1 from jsonb_object_keys(s) k where k not in ('url','label')) or jsonb_typeof(s->'url') is distinct from 'string' or jsonb_typeof(s->'label') is distinct from 'string' or coalesce(s->>'url','') !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$' or length(s->>'url')>2000 or coalesce(length(s->>'label'),0) not between 1 and 200) then raise exception 'Sources must be labeled public HTTPS references' using errcode='22023'; end if;
 if exists(select 1 from jsonb_each(content) e where e.key in ('title','body','type','company','role','stage','experienceDate','provenance','uncertainty') and jsonb_typeof(e.value) not in ('string','null')) or exists(select 1 from jsonb_each_text(content) e where e.key in ('company','role','stage') and length(e.value)>200) then raise exception 'Invalid knowledge fields' using errcode='22023'; end if;
 if content->>'experienceDate' is not null then
  if content->>'experienceDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'ISO experience date required' using errcode='22023'; end if;
  perform (content->>'experienceDate')::date;
 end if;
end $$;

create function private.knowledge_projection(p private.knowledge_posts, viewer uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'circleId',p.circle_id,'parentId',p.parent_id,'revision',r.revision,'publishedRevision',p.published_revision,'state',p.state,'owned',p.author_id=viewer,'author',m.alias,'createdAt',p.created_at,'content',r.content,'agentAuthored',r.connection_id is not null,'approved',p.author_id=viewer and exists(select 1 from private.knowledge_approvals where post_id=p.id and revision=r.revision),'helpfulPeople',(select count(*) from private.knowledge_citations c where c.post_id=p.id and c.revision=r.revision and c.retracted_at is null),'url','https://wcia013twe.github.io/codex-automated-job-board/circles/?circle='||p.circle_id||'&thread='||coalesce(p.parent_id,p.id),'untrusted',true)
 from private.knowledge_revisions r join private.circle_members m on m.circle_id=p.circle_id and m.user_id=p.author_id
 where r.post_id=p.id and r.revision=case when p.author_id=viewer then p.current_revision else p.published_revision end and p.state not in ('withdrawn','hidden')
$$;

create function private.knowledge_action(actor uuid,op text,payload jsonb,connection uuid default null) returns jsonb language plpgsql set search_path='' as $$
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
      if not (content->>'type'=any(m.allowed_types)) or content->>'type' not in ('resource','opportunity') or (content->>'personalDisclosure')::boolean or content->>'provenance'<>'agent_observed' or content->>'company' is not null or content->>'role' is not null or content->>'stage' is not null or content->>'experienceDate' is not null or content->>'uncertainty' is not null or content->>'title'<>'Shared public resource' or content->>'body'<>'A public resource to evaluate independently.' or jsonb_array_length(content->'sources')<>1 or content->'sources'->0->>'label'<>'Public source' or content->'sources'->0->>'url' !~ '^https://(www[.])?(postgresql[.]org/docs/|docs[.]python[.]org/|developer[.]mozilla[.]org/|supabase[.]com/docs/)[a-zA-Z0-9/_.-]*$' then raise exception 'Exact human review required for freeform or personal content' using errcode='42501'; end if;
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
revoke all on function private.knowledge_action(uuid,text,jsonb,uuid),private.validate_knowledge_content(jsonb),private.knowledge_projection(private.knowledge_posts,uuid) from public,anon,authenticated;
create function public.knowledge_action(operation text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 return private.knowledge_action(auth.uid(),operation,payload,null);
end $$;
revoke all on function public.knowledge_action(text,jsonb) from public,anon;
grant execute on function public.knowledge_action(text,jsonb) to authenticated;
alter function public.agent_dispatch(text,text,jsonb) rename to knowledge_previous_dispatch;
alter function public.knowledge_previous_dispatch(text,text,jsonb) set schema private;
revoke all on function private.knowledge_previous_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.agent_dispatch(credential_hash text,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c private.agent_connections; needed text;
begin
 if operation not like 'knowledge.%' and operation not like 'circles.%' then return private.knowledge_previous_dispatch(credential_hash,operation,payload); end if;
 select * into c from private.agent_connections where token_hash=credential_hash and revoked_at is null and expires_at>now() for share;
 if not found then raise exception 'Invalid credential' using errcode='28000'; end if;
 needed:=case when operation in ('circles.list','circles.read','knowledge.search','knowledge.read','knowledge.citations','knowledge.handoff') then 'knowledge:read' else 'knowledge:write' end;
 if not needed=any(c.scopes) or not ('knowledge:read'=any(c.scopes)) then raise exception 'Knowledge scope required' using errcode='42501'; end if;
 return private.knowledge_action(c.user_id,operation,payload,c.id);
end $$;
revoke all on function public.agent_dispatch(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.agent_dispatch(text,text,jsonb) to service_role;

create or replace function public.manage_agent_connection(owner_id uuid, operation text, payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_variable
declare connection private.agent_connections; days integer; result jsonb;
begin
  if operation = 'connections.issue' then
    days := coalesce((payload->>'expiresInDays')::integer,30);
    if days not between 1 and 90 or length(trim(payload->>'name')) not between 1 and 80
      or payload->>'tokenHash' !~ '^[a-f0-9]{64}$'
      or jsonb_typeof(payload->'scopes') <> 'array' or jsonb_array_length(payload->'scopes') = 0
      or exists(select 1 from jsonb_array_elements_text(payload->'scopes') s where s not in ('knowledge:read','knowledge:write','workspace:read','profile:write','answers:write','network:write','tracking:write','resumes:write','preferences:write','resumes:read','batches:write','drafts:write','activity:write','approvals:read'))
      then raise exception 'Invalid connection' using errcode='22023'; end if;
    -- Limits accidental repeated provisioning; revoked/expired entries do not count.
    if (select count(*) from private.agent_connections where user_id=owner_id and revoked_at is null and expires_at>now()) >= 10 then
      raise exception 'Revoke an existing connection first' using errcode='22023';
    end if;
    insert into private.agent_connections(user_id,name,token_hash,scopes,expires_at)
      values(owner_id,trim(payload->>'name'),payload->>'tokenHash',array(select jsonb_array_elements_text(payload->'scopes')),now()+make_interval(days=>days)) returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.profile_setup' then
    if jsonb_typeof(payload->'enabled') is distinct from 'boolean' then raise exception 'Enabled boolean required' using errcode='22023'; end if;
    select * into connection from private.agent_connections where user_id=owner_id and id=(payload->>'id')::uuid and revoked_at is null and expires_at>now() for update;
    if not found then raise exception 'Active owned connection not found' using errcode='P0002'; end if;
    update private.agent_connections set scopes=case when (payload->>'enabled')::boolean then
      array(select distinct s from unnest(connection.scopes || array['profile:write']) s) else array_remove(connection.scopes,'profile:write') end
      where id=connection.id returning * into connection;
    return to_jsonb(connection)-'token_hash';
  elsif operation = 'connections.list' then
    select coalesce(jsonb_agg(to_jsonb(c)-'token_hash' order by created_at desc),'[]') into result from private.agent_connections c where user_id=owner_id;
    return result;
  elsif operation = 'connections.revoke' then
    update private.agent_connections set revoked_at=coalesce(revoked_at,now()) where user_id=owner_id and id=(payload->>'id')::uuid returning * into connection;
    if not found then raise exception 'Owned connection not found' using errcode='P0002'; end if;
    return to_jsonb(connection)-'token_hash';
  end if;
  raise exception 'Unknown operation' using errcode='22023';
end $$;
revoke all on function public.manage_agent_connection(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.manage_agent_connection(uuid,text,jsonb) to service_role;


commit;
