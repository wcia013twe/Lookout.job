-- Typed authored pointers in the isolated demo projection, not a target-content access grant.
begin;
alter table intelligence_demo.intelligence_reports
 add column post_references jsonb not null default '[]' check(jsonb_typeof(post_references)='array' and jsonb_array_length(post_references)<=32),
 drop constraint intelligence_reports_company_context,
 add constraint intelligence_reports_company_context check(source_type='circle_post' or company is not null),
 drop constraint intelligence_reports_insight_check,
 add constraint intelligence_reports_insight_check check(
  length(insight)<=case when source_type='circle_post' then 16000 else 4000 end and
  (length(insight)>0 or content_kind='resource' and jsonb_array_length(resource_links)>0)
 );
commit;
