# Agent acceptance testing

- Added 42 prioritized, source-grounded acceptance cases spanning onboarding/profile, discovery, applications, tracking, maintenance, privacy and Cloud Run recovery, with pass evidence and explicit execution status.
- Started the first real Muse CLI profile/onboarding audit. Recorded transport mismatch, stale onboarding, résumé identity checks and the audit-append blocker without storing private facts or credentials.
- Independently verified the one profile correction and all seven owned résumé file checksums. No employer action occurred.
- Validation: npm test (1,483 passed), npm --prefix next-app run typecheck, npm run validate:data (158 roles), git diff --check.
- Muse Cloud Run list-tools test reached a network approval gate for the new hostname; no approval was forged or bypassed.
- Limits: full checklist is not executed; profile freshness and current Cloud Run agent connection remain unresolved. Audit append error is reported, not reproduced or fixed. Documentation-only pass; no product behavior or demo fixture changes.

## Main-workflow follow-up

- Narrowed live acceptance to profile, backend/shared discovery, one draft, correction/resume and tracking. Documented independent persisted evidence and remaining gaps.
- Clarified the existing publish_batch jobFacts requirements after Muse omitted sponsorship and received a validation failure; validation behavior is unchanged.
- Profile graduation guidance/default résumé, shared-pool batch and one draft correction are independently verified. Cloud Run discovery recovered after Muse closed a dormant sweep through scoped tools; independent reads confirm 48 review-needed screenings, 68 completed sources and 54 blocked sources. A three-role subset was published; independent employer checks exposed a graduation mismatch and an experience stretch. Muse hid the ineligible role and saved an honest correction note; the immutable stretch-role card score remains unchanged. Draft review continuation and a November 17 internal follow-up are independently verified.
- Added a focused manual OpenWiki current-state update with live evidence and historical staging limits. No blanket launch claim: full-time résumé variant, human draft answer/review, recommendation presentation and Cloud Run MCP host migration remain unresolved.
- Validation: npm test (1,483/1,483), focused job-assessment tests (11/11), frontend typecheck, npm run validate:data (158 roles), git diff --check. No employer action; no demo fixture change for tool-description/documentation only.
