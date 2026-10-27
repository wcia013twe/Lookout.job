-- Extend only the local demo projection. No source reads or sharing grants are added.
begin;
alter table intelligence_demo.intelligence_reports
 add column content_kind text not null default 'observation' check(content_kind in ('observation','resource')),
 add column title text check(title is null or length(title) between 1 and 200),
 add column resource_links jsonb not null default '[]' check(jsonb_typeof(resource_links)='array' and jsonb_array_length(resource_links)<=16),
 add column contexts jsonb not null default '[]' check(jsonb_typeof(contexts)='array' and jsonb_array_length(contexts)<=6),
 alter column company drop not null,
 drop constraint intelligence_reports_insight_check,
 add constraint intelligence_reports_company_context check(content_kind='resource' or company is not null),
 add constraint intelligence_reports_resource_title check(content_kind<>'resource' or title is not null),
 add constraint intelligence_reports_insight_check check(
  (content_kind='observation' and length(insight) between 1 and 4000) or
  (content_kind='resource' and length(insight)<=16000 and (length(insight)>0 or jsonb_array_length(resource_links)>0))
 );
commit;
