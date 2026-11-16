# interview-entry-presets

- Navigation follow-up: removed the secondary Overview / Research / Rounds / Notes tabs. Companies now open one preparation page with tasks, research, rounds and notes; round drilldown and reader return context remain intact. Legacy view URLs no longer hide company content. Unassigned and other linked materials remain accessible.
- Follow-up validation: 18 focused tests, frontend typecheck/static build and data validation passed. Recorded demo company → round → company navigation; 390px round detail has no horizontal overflow. OCR deterministic selection/rules and host review covered both changed UI files (2/2, none skipped), not an independent endpoint review. Full-suite results retain the three previously documented failures.

- Added six Answer Bank preset questions with accessible write/edit pencil buttons, prefilled question/category, blank answer and existing-answer reuse through the versioned editor.
- Interviews now includes only explicit post-screening interview progress. Screening-only and initial applications stay out; their materials remain accessible. Previous qualifying processes remain available.
- No schema, dependency or MCP boundary changes: saves use the existing owned/versioned artifact service.
- Validation: frontend typecheck/build, catalog validation (158 roles), 18 focused projection/preset/demo tests, whitespace and Impeccable detection passed. Full suite: 1478 tests, 1475 passed; existing vendored-manifest, 108-provider and stale-document-codec failures remain. The additional demo regression passed afterward.
- Recorded fictional-demo preset creation/save, return, saved status and reopen editing; mobile viewport 390px had no horizontal overflow. No real account writes. Round-detail reference retains actual saved task/session progress rather than fake checkbox state.
- Limits: no hosted deployment or independent OCR endpoint review; host reviewed focused changes. No push/publication.
