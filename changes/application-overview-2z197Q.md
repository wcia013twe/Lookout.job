# Application Overview clarity

- Refined only the Overview content of application details: icon-led job facts, compact recorded progress/preparation, semantic attention/context surfaces and an expandable description. Other tabs and the status/notes sidebar retain their behavior.
- Kept reported hiring progress distinct from draft preparation and submission evidence. Unknown facts remain explicit; uncertain attempts and blocked-without-reason records are visible. Completed preparation states do not prompt old question/resume review.
- The Documents shortcut uses existing tab navigation; no backend writes, approval, submission, MCP tools or scoring capabilities changed.
- Demo coverage includes fictional interview details, its existing uncertain attempt, submitted applications and a saved role without a draft. Demo data remains isolated from real account storage and external submissions.
- Validation: 436 tests, frontend typecheck, data validation (147 roles), static production build, whitespace check and mocked desktop-dark/mobile-light Overview checks. Browser coverage includes icon facts, no stale review prompts, uncertainty, saved-without-draft, Documents navigation, Escape, overflow and no Overview cloud calls.
- Limits: no real account or employer form was exercised; fit notes are collected research, not a new AI evaluation. The existing Next.js dependency advisory remains outside this UI-only change.
