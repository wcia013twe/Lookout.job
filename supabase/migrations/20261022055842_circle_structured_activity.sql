begin;
-- Extend the existing revision table; never rewrite reviewed historical content.
-- Discussion-only, disclosed activity cannot use public-resource standing permission.

create or replace function private.validate_knowledge_content(content jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(content) is distinct from 'object' then raise exception 'Content object required' using errcode='22023'; end if;
 if content::text ~* '(storage/v1/object/(sign|authenticated)/|[?&](token|access_token|apikey|api_key|signature|x-amz-signature)=|mail[.]google[.]com/|outlook[.]office[.]com/mail/)' then raise exception 'Private sources and signed file links cannot be shared' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(content) k where k not in ('title','body','type','company','role','stage','experienceDate','sources','provenance','uncertainty','personalDisclosure','insight','jobUrl','jobId','offers','contexts','activity'))
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
 if content ? 'activity' then
  if content->>'type'<>'discussion' or content->'personalDisclosure' is distinct from 'true'::jsonb or jsonb_typeof(content->'activity') is distinct from 'object' then raise exception 'Activity requires a discussion with personal disclosure' using errcode='22023'; end if;
  if exists(select 1 from jsonb_object_keys(content->'activity') k where k not in ('highlights','goal','help')) or jsonb_typeof(content->'activity'->'highlights') is distinct from 'array' or jsonb_typeof(content->'activity'->'goal') is distinct from 'string' or jsonb_typeof(content->'activity'->'help') is distinct from 'string' then raise exception 'Invalid activity fields' using errcode='22023'; end if;
  if jsonb_array_length(content->'activity'->'highlights')>3 or exists(select 1 from jsonb_array_elements(content->'activity'->'highlights') h where jsonb_typeof(h) is distinct from 'string' or length(trim(h#>>'{}'))=0 or length(h#>>'{}')>300) or length(content->'activity'->>'goal')>300 or length(content->'activity'->>'help')>300 then raise exception 'Activity fields exceed limits' using errcode='22023'; end if;
  if jsonb_array_length(content->'activity'->'highlights')=0 and length(trim(content->'activity'->>'goal'))=0 and length(trim(content->'activity'->>'help'))=0 then raise exception 'Activity cannot be empty' using errcode='22023'; end if;
 end if;
 if content->>'experienceDate' is not null then
  if content->>'experienceDate' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'ISO experience date required' using errcode='22023'; end if;
  perform (content->>'experienceDate')::date;
 end if;
end $$;

alter table private.knowledge_revisions drop column search_document;
alter table private.knowledge_revisions add column search_document tsvector generated always as (to_tsvector('english',coalesce(content->>'title','')||' '||coalesce(content->>'body','')||' '||coalesce(content->>'insight','')||' '||coalesce(content->>'company','')||' '||coalesce(content->>'role','')||' '||coalesce(content->>'jobId','')||' '||coalesce(content->>'stage','')||' '||coalesce(content->'offers','[]'::jsonb)::text||' '||coalesce(content->'contexts','[]'::jsonb)::text||' '||coalesce(content->'activity','{}'::jsonb)::text)) stored;
create index knowledge_search on private.knowledge_revisions using gin(search_document);

revoke all on function private.validate_knowledge_content(jsonb) from public,anon,authenticated;

commit;
