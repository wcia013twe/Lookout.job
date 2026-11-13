# interview-prep

- Partial, time-boxed Interview Prep redesign: all-date artifact loading, application-linked workspace navigation, reusable-material tabs, and preserved artifact reader/revision operations. Existing fictional demo materials exercise the new index without accessing real accounts.
- Added an explicit-link-only projection and four regression tests. No schema, persistence contract, or orchestration changes.
- Validation: four focused tests pass; frontend typecheck and static production build pass; catalog validation passes (158 roles). Desktop demo and 390px mobile inspected; mobile index has no horizontal overflow. Recording captured.
- Full suite: 1456 passed, three failed (vendored manifest/provider checks and stale generated search document bundle). OCR preview succeeded; AI review unavailable because no LLM endpoint is configured.
- Incomplete: full answer-entry editing/status/categories, persistent checklist interactions, single living research brief semantics, complete pipeline prioritization, and comprehensive navigation/refresh tests. This checkpoint does not satisfy the full acceptance criteria and is not landed, pushed, or deployed.
