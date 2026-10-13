alter table public.answer_library add column autofill_policy text not null default 'ask' check(autofill_policy in ('ask','auto')), add column company_scope text;
alter table public.answer_library add constraint autofill_requires_verification check(autofill_policy <> 'auto' or verified_at is not null);
