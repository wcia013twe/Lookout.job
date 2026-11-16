# Agent acceptance testing

- Added 42 prioritized, source-grounded acceptance cases spanning onboarding/profile, discovery, applications, tracking, maintenance, privacy and Cloud Run recovery, with pass evidence and explicit execution status.
- Started the first real Muse CLI profile/onboarding audit. Recorded transport mismatch, stale onboarding, résumé identity checks and the audit-append blocker without storing private facts or credentials.
- Independently verified the one profile correction and all seven owned résumé file checksums. No employer action occurred.
- Validation: npm test (1,483 passed), npm --prefix next-app run typecheck, npm run validate:data (158 roles), git diff --check.
- Limits: full checklist is not executed; profile freshness and current Cloud Run agent connection remain unresolved. Audit append error is reported, not reproduced or fixed. Documentation-only pass; no product behavior or demo fixture changes.
