-- Private account staging accepts real source records independently of demo fixtures.
-- No publication policy or source polling is enabled by this migration.
begin;
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create table private.intelligence_reports(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 source_type text not null check(source_type in ('circle_post','application_update')),
 source_id text not null check(length(source_id) between 1 and 200),source_revision integer not null check(source_revision>0),
 content_kind text not null check(content_kind in ('observation','resource')),title text check(title is null or length(title) between 1 and 200),
 company text check(company is null or length(company) between 1 and 200),role text,stage text,
 insight text not null check(length(insight)<=16000),experience_date date,provenance text not null check(provenance in ('employer_verified','user_confirmed','agent_observed','agent_inferred','unknown')),uncertainty text,
 sharing_status text not null default 'private_draft' check(sharing_status='private_draft'),
 resource_links jsonb not null default '[]' check(jsonb_typeof(resource_links)='array' and jsonb_array_length(resource_links)<=16),
 contexts jsonb not null default '[]' check(jsonb_typeof(contexts)='array' and jsonb_array_length(contexts)<=6),
 post_references jsonb not null default '[]' check(jsonb_typeof(post_references)='array' and jsonb_array_length(post_references)<=32),
 content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),processing_version text not null,embedding_text text not null,
 embedding extensions.vector(1536),embedding_model text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(owner_id,source_type,source_id),check((embedding is null)=(embedding_model is null)),
 check(embedding_model is null or embedding_model not like 'fixture-%'),
 check(source_type='circle_post' or company is not null),check(content_kind<>'resource' or title is not null)
);
alter table private.intelligence_reports enable row level security;
revoke all on private.intelligence_reports from public,anon,authenticated;
commit;
