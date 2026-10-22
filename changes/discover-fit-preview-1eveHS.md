# Discover match previews and job detail panel

- Discover cards now show four fit dimensions and open a right-side job preview instead of simulating an external open. Mobile uses the full viewport width.
- The panel includes available job details, collected AI/research reasoning, explicit verification gaps and Common-or-above contact-field prefill from saved profile facts. Edits are temporary; no employer form is fetched or filled and no approval or submission occurs.
- Previewing does not track a role. Opening the actual employer posting retains the existing tracker behavior, including prior dates/statuses. Account/demo/reset changes invalidate the preview selection.
- Admin demo fixtures add fictional strong, partial and unassessed scenarios, including missing compensation evidence. Demo previews make no external posting action and remain resettable and isolated.
- Read-only UI composition uses existing context boundaries; no backend or MCP tool contract changed. Live score generation, employer form mapping and actual application prefill remain unconnected.
- Moved this isolated checkout, frontend dependencies, npm cache and browser artifacts to the external SSD. Fixed an existing worker URL-to-path conversion so the runner works in paths containing spaces.
- Validation: frontend typecheck, data validation (147 roles), all 436 tests after integrating local main, static production build, diff whitespace check, and mocked browser checks at desktop/dark and mobile/light. Browser checks cover panel content, missing scores, prefill, discarded edits, Escape/focus restoration, no preview service calls, no demo external links and horizontal overflow.
- Limits: no real account, employer form or live AI assessment was exercised. Sample percentages are labeled fictional, and real catalog roles show unassessed scores. The installed Next.js version emitted a dependency security advisory before a successful build retry; no dependency upgrade was included.


## Follow-up: job facts and focused human review

- Added icon-led fact tags on Discover cards and a six-fact grid in the panel. Missing pay, work-setting and sponsorship evidence stays explicit; no live-confirmation claim is inferred from source recency.
- Added theme-aware green/amber surfaces for fit evidence and uncertainty, compact scoring chevrons and expandable job descriptions to reduce text density.
- Replaced the always-open contact form with Application review: missing contact fields and unreviewed recorded employer questions are visible, populated contacts start collapsed, and unverified saved contacts remain flagged for human confirmation. Edits stay temporary; this creates no consent or backend writes.
- Demo fixtures now include fictional fact tags and one/two unanswered questions. Browser verification checks icon facts, collapsed contacts, visible review questions and discarded question/contact edits alongside the prior keyboard, mobile and isolation checks.
- Validation: 436 tests, frontend typecheck, data validation (147 roles), production static build, diff whitespace check and desktop-dark/mobile-light browser verification. No live form, submission, AI evaluation or new MCP capability was added.
