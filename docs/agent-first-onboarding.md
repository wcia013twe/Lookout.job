# Lookout agent-first onboarding — implementation handoff

Status: **proposed UX and engineering specification, not implemented behavior**. Target: Muse, other bring-your-own-agent (BYOA) runtimes, and future managed texting agents. Use this as an implementation plan; inspect the actual repository contracts and deployed capabilities before changing code.

## Product objective

**Time to first value is the priority.** The first meaningful interaction should produce **one verified, relevant job** as soon as enough information is available, then ask what Lookout should do with opportunities like it. Do not require a full profile questionnaire, UI tour, social setup, or notification matrix before the first recommendation.

Lookout is agent-first and text-first. The optional website provides visual review and granular settings; a capable connected agent should be able to perform the normal workflow conversationally. The backend is the **authority for state and permissions**, not the agent's prose.

## First-run journey

1. **Connect or identify runtime.** Offer supported agent options (Muse, other supported BYOA, future managed agent). Verify the credential and actual tool capabilities; don't claim a connection based on a pasted token alone. Ask for name only if unavailable and necessary.
2. **Get minimum search intent.** Import permitted existing context or ask one open question: “What kind of jobs are you looking for?” Parse role, level, employment type, locations/remote, compensation and team/company preferences. Ask only for missing hard constraints. Do not invent eligibility or preferences.
3. **Find the first job.** Search actual sources, deduplicate, validate employer URL and availability as far as tools permit, and produce a concise fit explanation grounded in available evidence. If resume is missing, label fit preliminary. If no credible result is available, say so and ask a focused refinement; never invent a demo role as real.
4. **Ask a contextual action question.** “Want me to recommend jobs like this, prepare applications for review, or set up auto-apply for routine matches?” This is a *policy choice*, not authorization to submit the displayed job or all future jobs.
5. **Progressive setup based on choice.**
   - Recommend-only: save preferences, start discovery if scheduling exists; resume optional.
   - Prepare-for-review: import/upload resume and verify essential facts; queue draft preparation, never submit without authorized workflow.
   - Auto-apply requested: gather verified resume, exact-answer permissions, review thresholds and scope; show clear summary for user confirmation. Leave disabled until backend validation and supported submission runner are confirmed. Important roles, unknown answers, unsupported forms and uncertain outcomes require review. Never turn conversational assent into a fabricated human approval.
6. **Return actual result.** Report a verified first batch, prepared draft, or concrete blocker; distinguish *requested*, *queued*, *running*, *prepared*, *submitted*, *uncertain*, and *failed*. Ask only the next necessary question.
7. **Configure delivery in context.** Offer daily roundup, important matches, or quiet mode (action-needed alerts only); independently control social notifications. Record channel, timezone and user-selected delivery time when needed. Claim activation only after scheduler/channel confirms it.
8. **Introduce optional website and Circles after value.** Briefly explain that detailed cards, application review, and advanced preferences are available on the website, but conversation remains primary. Default social visibility to private; explicit separate permission for every class of shared event.

## Example chat — conceptual, no real application implied

User: “Looking for backend internships in the Bay Area.”

Agent: “I found a Backend Software Engineer Intern opening at ExampleCo. It appears aligned with your backend interests. I haven't reviewed your resume yet, so this is a preliminary match. Want me to (1) keep finding roles, (2) prepare applications for review, or (3) help set up automatic applications for routine matches?”

User: “3.”

Agent: “I can configure that. First I need a verified resume and your approval rules. Important roles and unfamiliar questions will still stop for review. Do you want me to use the resume you already shared with your agent, or upload one?”

User: “Use my current resume.”

Agent: “I'll import it if this agent has permission, then ask you to confirm any missing details. Auto-submission remains off until the backend confirms the setup and supported submission tools.”

Later, after verified preparation: “Your ExampleCo application is prepared. Two answers need review. Want to handle them now or in your next digest?”

## Deterministic onboarding state machine

Proposed states: `connection_pending` → `intent_pending` → `first_match_pending` → `action_policy_pending` → `profile_verification_pending` (conditional) → `execution_ready` → `delivery_pending` → `ready`.

Allow branches for recommend-only, prepare, and auto-apply, plus `blocked`, `retryable_error`, `paused`, and `skipped_optional`. “Ready” means actual prerequisites were verified, not that the agent promised completion. State must survive reconnects and interrupted conversations. Record revision, timestamps, owner, active step, completed steps, capability flags, and blockers. Keep safe defaults.

Proposed server operations (names illustrative; do not assume they exist):
- `onboarding.get_state` — read authoritative state, required fields, supported capabilities and next step.
- `onboarding.submit_step` — validate allowed transitions with expected revision and idempotency key; return next prompt schema.
- `tasks.create` / `tasks.read` — enqueue and retrieve user-scoped work, never a free-form instruction to bypass policy.
- `tasks.report_result` — report actual outcome with evidence, status, and blockers.

Agent renderer: present the server-provided prompt as plain text with numbered choices; native buttons/cards only if the host supports them. Free-text answers can be interpreted by the agent, but the server validates values and transitions. Same contract for web, Muse, and managed agent.

## UI actions → agent work

When the user clicks an action on the optional Lookout UI:
1. Authenticate the user and validate authorization.
2. Persist a versioned task with owner, operation, target IDs, policy, expected revision and idempotency key.
3. Dispatch through **optional push** to a runtime with authenticated inbound hooks (e.g., a managed agent), or let a BYOA agent **poll** on its scheduled runs. Muse inbound hooks are **not verified**; do not promise immediate execution.
4. Agent claims the task, reads current canonical records, performs only permitted tools, and reports outcome.
5. Notify through the agent's verified channel or show updated task state in the UI. A webhook acknowledgment is **not** proof of task completion.

Suggested lifecycle: `queued → claimed → running → completed | needs_user | failed | uncertain`. Replayed events and concurrent workers must not duplicate submissions. The existing guarded submission protocol remains authoritative.

Example notification payload (not an instruction to submit):
```json
{"event":"task_available","task_id":"task_123","kind":"prepare_application"}
```

## Privacy, policy and security invariants

- Never treat agent memory as data Lookout can automatically read; use only expressly available, scoped integrations.
- Store verified personal facts separately from agent hypotheses; unknowns remain unknown.
- Resume imports and answer proposals remain unverified until required human review.
- “Auto-apply requested” is not “auto-apply enabled.” Honor existing company tiers, full-time/internship review policy, versioned approvals, exact submission authorization, one-use permits, duplicate protection, and uncertain-outcome blocking.
- Quiet mode governs interruptions; social mode governs sharing. They are independent. Social sharing starts private and requires separate authorization.
- Never publish application or interview milestones from onboarding by default.
- Agent credentials and user IDs are not authority by themselves; derive ownership from authenticated context. Keep secrets out of chat links, logs, and public data.
- Add rate limits, bounded retries, error reporting, and resumability.

## Existing repo constraints to inspect/reuse

- `README.md`: current Next.js/React/Tailwind UI, Supabase storage and agent integration; live Muse scheduling and notification delivery still need verification.
- `backend/agent-contract.md`: `context.versions`, `context.personal`, `workspace.read`, `batches.publish`, `drafts.prepare`, scoped credential operations, and guarded submission transitions.
- `backend/MUSE_FEATURE_PARITY.md`: shared website/MCP ownership rules, preparation and milestone operations, quiet-mode settings.
- `supabase/migrations/`: authoritative schema; don't duplicate state that existing tables already own.
- `supabase/functions/agent-gateway/`, `agent-mcp/`, `next-app/`: extend existing operations and UI instead of building parallel products.
- Native Greenhouse submission is supported in the documented runner, but live Muse/employer validation and other ATS adapters remain limited. Do not describe unsupported application execution as working.

## Implementation order and acceptance tests

**Phase A: deterministic conversational onboarding.** Persist/recover state; parse intent; verify first job; capture policy; import profile conditionally; present truthful completion/blockers. Test with plain-text agent renderer.

**Phase B: event bridge.** Queue user-scoped tasks, implement push for verified managed runtime, polling fallback for BYOA, lifecycle and receipts; connect UI actions to task status.

**Phase C: delivery and progressive controls.** Verify scheduled notifications, introduce optional UI tour, quiet/social settings and privacy defaults without slowing first value.

Acceptance scenarios:
- Existing agent with usable profile sees a verified job before being asked for full onboarding details.
- New user with no resume gets a preliminary job and can choose recommend-only.
- Selecting auto-apply never causes a submission before required authorization, verified answers and supported runner capability.
- Refresh, reconnect, duplicate webhook and concurrent agent calls do not skip steps or submit twice.
- Unsupported Muse hooks use polling and show realistic latency, not “done.”
- A failed scan, missing resume, or unavailable scheduler produces an honest next action.
- User can complete the core experience without opening the optional UI, except where a specific human-only approval action requires it.
- One user's agent cannot read another user's onboarding state, files, or tasks.

**North-star metric:** time to first *verified relevant opportunity*, followed by successful repeat usage. Do not optimize merely for completing a questionnaire.
