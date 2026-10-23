# Dynamic job research and saved company rankings

- Replaced fixed company-name rarity tables with owned saved tier placements. Selected profile list bindings take precedence; missing/ambiguous placements display Unranked. Packs include all non-skipped roles regardless of tier and preserve profile associations.
- Real job cards and previews render saved private matchAssessment data, arbitrary evidenced factors and materialGap text. Empty assessments no longer create four fixed factor rows; missing gaps do not claim a resume comparison was unavailable.
- Batch hydration preserves recorded source freshness, leaves unspecified priority unset and safely ignores malformed historical assessments. Missing feed employment types are no longer silently classified as FT.
- Outreach copy uses agent-neutral queue state and does not promise execution by Muse.
- Migration extends validation on the existing private batch_items.recommendation JSON contract. It introduces no parallel table and preserves historical records, application statuses and approvals without synthetic backfills.
- MCP parity: existing scoped publish_batch/batches.publish writes private research through gateway validation plus the database trigger. Existing owner-scoped browser reads render the same records; prepare_draft continues to supply dynamic employer questions/answers. Approval and submission boundaries are unchanged.
- Updated backend and MCP contracts, developer instructions (version 51), source toolkit catalog and generated career-find-jobs guide (version 5). Guide generation remains reproducible.
- Demo coverage: explicit fictional gap text, saved ranked/unranked tier fixtures and preserved fictional onboarding score labels. Demo state remains isolated/resettable.
- Validation: npm test passed all 545 feature tests before local-main integration; final integration verification recorded below, including database validation/owner isolation/retries, historical migration preservation, MCP publication, rendered score/empty/demo states, hydration and saved ranking changes. npm run validate:data validated 158 roles; production static build and TypeScript passed. git diff --check and Impeccable detector passed.
- Limits: no live employer-form retrieval, browser visual inspection or hosted migration/MCP deployment performed. Production requires the normal post-merge migration/gateway/frontend workflow; local validation does not assert hosted parity. No push or PR publication.

- Local-main integration: preserved the concurrent website-onboarding migration and both database scenarios; advanced developerVersion to 51. Refreshed locked SSD dependencies. Final integrated npm test passed all 548 tests; catalog validation and production static build passed again.
