-- Local fictional demo storage only. This migration does not read career records or enable production ingestion.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create schema if not exists intelligence_demo;
revoke all on schema intelligence_demo from public,anon,authenticated;
create table intelligence_demo.intelligence_reports(
 id uuid primary key default gen_random_uuid(),
 source_type text not null check(source_type in ('circle_post','application_update')),
 source_id text not null check(source_id ~ '^[a-zA-Z0-9:_-]{1,200}$'),
 source_revision integer not null check(source_revision>0),
 company text not null check(length(company) between 1 and 200),role text,stage text,
 insight text not null check(length(insight) between 1 and 4000),experience_date date,
 provenance text not null check(provenance in ('employer_verified','user_confirmed','agent_observed','agent_inferred','unknown')),
 uncertainty text,sharing_status text not null default 'demo_only' check(sharing_status='demo_only'),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),processing_version text not null,
 embedding_text text not null,embedding extensions.vector(1536) not null,embedding_model text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(source_type,source_id)
);
alter table intelligence_demo.intelligence_reports enable row level security;
revoke all on intelligence_demo.intelligence_reports from public,anon,authenticated;
commit;
