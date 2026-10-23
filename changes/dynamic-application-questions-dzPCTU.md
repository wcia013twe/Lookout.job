# Dynamic application review

- Discover renders recorded employer questions dynamically, showing unanswered fields and custom answers awaiting review. Completed profile/library answers and attached files stay out of this decision list; empty lists hide the section.
- Removed invented contact-field requirements and profile-verification blockers from role previews. No approval or backend state is changed.
- Existing scoped drafts.prepare/prepare_application flow supplies the questions and answers; no new service boundary. Backend reuse/approval validation remains authoritative.
- Demo coverage includes one decision, multiple decisions and only a completed profile answer (no review section).
- Validation: focused filtering/demo tests, TypeScript, catalog validation and production static build passed; Impeccable detector reported no findings.
- Full npm test ran: database scenarios completed but PGlite shutdown failed with `null function or function signature mismatch`; isolated database rerun reproduced it. Full failure logs: /private/tmp/dynamic-questions-tests.log and /private/tmp/dynamic-questions-db.log.
- Limits: no live employer-form retrieval, deployed MCP verification or browser visual inspection performed. Preview edits remain temporary; saved drafts are edited in Applications.
