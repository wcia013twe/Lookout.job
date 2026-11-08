# Discover facts and five-point analysis

- Preserve detailed source-backed attendance and sponsorship text. Render the five
  saved analysis labels as escaped semantic bullets with legacy prose fallback.
  Null scores say “Not rated” and show their saved rationale in expanded previews.
- Reuse the existing explicit rejection fix, read the existing imported-history
  service, and inspect all matching native/imported/tracker records. Never infer
  a requisition from an unbound title or email. No status or account data changes.
- Correct only the batch publication link through a narrow migration. Existing
  employer facts, dispatch scopes and grants remain unchanged.
- Fictional demo covers detailed unknowns, disclosed hourly pay with an unrated
  score, and five-label analysis. Regression checks include escaped React output,
  imported/native duplicates and replayed batch links.
- Validation: npm test (1,108 passed, 5 skipped, zero failed), frontend typecheck,
  data validation (158 roles), production static build, and git diff --check.
  React render tests verify five semantic bullets and escaped text. Browser visual
  verification is blocked by the connected browser's undefined timeoutMs error;
  no active user tab is controlled. The browser regression script is updated but
  not run, and live rendering will not be claimed without separate verification.
- The release branch is based on published main plus the scoped exclusion fix;
  unrelated unpublished Action Board work and its active role-card rewrite are
  deliberately excluded.

- Production PR #81 passed hosted CI at a71ba7f7 and merged as 3322dea0.
  Local-main integration preserves the independently landed compact-card changes,
  keeping their UI-test selectors and this pass's five-bullet/unrated assertions.
  Integrated local checks: 1,123 passed, 5 skipped, zero failed; typecheck,
  data validation, and production build passed. No local integration changes
  were pushed as part of the scoped production release.
