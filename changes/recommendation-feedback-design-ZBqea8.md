# recommendation-feedback-design

- Added a fictional, interactive Lavish prototype for one reusable Helpful / Not helpful control across analyzed roles, collected roles, and networking recommendations.
- Compare labeled and compact variants; exercise reversible ratings, optional domain-specific reasons and notes, and inspect a proposed version-bound feedback record. Uses Lookout theme tokens; examples reset on reload and perform no backend writes or submissions.
- Production design boundary: private human feedback, separate from approvals, available as future agent context rather than automatic model retraining. No product behavior, schema, MCP operation, or agent context was changed.
- Validation: npm test passed all 1,389 tests, including database scenarios; npm run validate:data passed for 158 roles; npm --prefix next-app run typecheck passed. Browser checks passed 18 interaction assertions covering all four example cards, rating changes/removal, notes, compact mode, and theme switching. No horizontal overflow at desktop or 390px mobile width; feedback buttons retain 44px touch targets. Recorded the preview interaction and responsive layout.
- Limits: design review only. Persistence, aggregation, permission enforcement, real-agent consumption, and hosted deployment are not implemented or verified.

## Review correction: use existing React components

- Replaced the recreated cards with a Lavish view of the actual React demo. Added one reusable, memory-only feedback row inside the existing RoleCard action track for both assessed and unassessed roles, preserving its shared grid tracks and existing facts, matching, and application actions.
- Reused Network's existing Agent Suggestions markup, currently hidden in ordinary product views. It appears only with both detached demo mode and `feedbackDesign=1`; normal demo and account views retain their existing behavior. The same explicit preview mode suppresses the automatic pack-opening overlay so it does not cover the cards being reviewed.
- Reversible Helpful / Not helpful buttons, optional reasons, and notes are illustrative UI only. No backend service, aggregation, MCP capability, or personal-agent context is implemented, and no feedback is persisted. No dependencies added. The preview flag and localhost server are deliberate review-only limits, not a production feature contract.
- Validation after the correction: npm test passed all 1,389 tests; npm run validate:data validated 158 roles; frontend typecheck and static production build passed. Browser checks passed 15 job rating assertions and six network assertions; both surfaces fit 390px with 44px feedback targets. Verified ordinary demo has no feedback controls. Recorded actual component interactions. A later nested-frame screenshot automation timed out; direct-page DOM inspection verified the built Network renders three feedback rows. Lavish uses a local static-export server with CORS rather than the dev server, whose sandboxed asset requests returned 403.
- Review URL depends on the local preview server remaining available. Persistence and live account/agent paths remain intentionally unverified and unimplemented.

## Compact feedback follow-up

- Replaced the tall feedback block with a single 36px check/cross row on the same Discover and Network components. No opens a native modal with optional reason and note plus the requested copy, “Your feedback improves your own agent.” Cancel and Escape preserve the current rating; submitting selects No locally; clicking a selected icon clears it.
- Kept the explicit detached-demo gate and a clear modal disclaimer: no feedback is saved or sent to the agent. Updated the existing Lavish review rather than creating replacement cards.
- Frontend typecheck, static build, data validation (158 roles), and diff whitespace checks passed. Browser checks covered selection, switching, clearing, modal cancel/submit/Escape, three Network rows, 390px modal fit on both surfaces, and absence in ordinary demo. Captured actual-component screenshots and an interaction recording.
- Full-suite validation initially reported 1,406 passes and two failures due to missing installed oidc-provider after the previous main integration; refreshed locked root dependencies. Both previously failing files then passed all 20 tests. Concurrent and serial full-suite reruns exited with code 1 without a final summary or a reported assertion failure; full-suite success remains unverified. No unrelated tests or dependencies were changed.

## Feedback learning PRD follow-up

Historical proposal: the implementation follow-up below supersedes its learning engine, inference budgets, and recurring-review assumptions.

- Added a draft PRD covering collected/analyzed jobs, networking suggestions, the actual planning agenda, shared persistence/MCP boundaries, deterministic personal context, evidence withdrawal, privacy, acceptance gates, and staged delivery.
- Proposed configurable usage budgets for capture, retrieval, optional summarization, tokens, model spend, concurrency, and retention. These are product proposals only: no runtime limit, paid call, schedule, schema, or production behavior changed. External agent-host spend is explicitly outside backend enforcement without verified host support.
- Reused this task checkout and incorporated committed local main through 5db11135 before drafting. Data validation passed for 158 roles; whitespace, PRD section/source-anchor checks, and budget arithmetic passed. The review artifact rendered at 728px and 390px without console messages. No runtime tests were run for this documentation-only pass; prior UI tests do not verify the proposed backend. Changes remain uncommitted for review; no push, publication, or local-main landing was performed.

## Private capture and external-agent implementation

- Replaced the demo-only preview with one reusable component on collected/analyzed job cards and details, actual Network suggestions, and underlying Weekly prep tasks. Check/cross, clear, editable negative reason/note, native dialog, and confirmed loading/saving/error/reload states share an account-bound batched cache. Public catalog jobs without an owned private-batch target do not mount feedback. Feedback remains separate from application, outreach, dismissal, and task-completion actions.
- Added owner-private current records and an immutable incremental change log. Authenticated browser saves validate source ownership, expected versions, and exact request replay. Server context captures existing job/contact/task recommendation evidence; supplied context cannot authorize access. MCP exposes only scoped read/list tools, never a writer of human ratings. Developer contract version is 167.
- Added reset registry entries and pending-reset write guards. A database sequence survives transaction rollback gaps and owner workspace deletion; per-owner transaction locks serialize changes so retained cursors do not skip later commits. External hosts still own interpretation, memory, and cursor checkpoints; a reset or clear does not prove external memory deletion.
- Enforced 100 targets/read, 100 changes/page, 60 fresh writes/owner/rolling minute, reason 200 characters, note 2,000 characters, supplied context 8,192 bytes, and SQL JSON payload 65,536 bytes. Frontend batches at 50. No model calls, summary engine, automatic preference updates, scheduler, inference spend limits, total-storage quota, or retention cleanup were introduced. Earlier notes may remain in private history after clearing current feedback.
- Simplified the PRD, review artifact, MCP guidance, and wiki boundary to match this implementation: immediate persistence, optional external-agent end-of-day/weekly review, and no automatic improvement promise. The scope artifact renders at 728px without console errors.
- Focused integration initially passed 21 tests; the additional public-catalog eligibility regression brings frontend feedback tests to 9 passing. Final frontend and intelligence typechecks pass; static export passes (441 offline assets), and data validation passes for 158 roles. Backend reset/sequence regressions pass all 3 focused tests. Final `npm test` passes all 1,438 tests with zero failures, cancellations, or skips; whitespace validation passes. Updated existing MCP catalog counts for the two new reads and the developer-version expectation to 167.
- All changes remain in the existing isolated checkout, uncommitted and unlanded. No push, hosted migration application, backend deployment, scheduler activation, real-account round trip, or external-agent memory update was performed. Browser interactions were not re-tested in this implementation pass; prior browser verification covered only the earlier demo design.

## Evening review follow-up

- Added feedback review to the existing default evening networking task, not a separate schedule. The external host reads at most 100 new/changed records per evening run, skips feedback inference for an empty page, reconciles edits/clears against compact memory, respects explicit directions, and checkpoints only after durable processing. Saved custom descriptions, timing, disabled state and assignments remain unchanged.
- Bumped connection-schedules to version 3, synchronized workflow routing, and incremented the developer contract to 168. Updated the PRD/MCP boundary and added regression coverage for default instructions, saved schedule preservation and the bounded host procedure.
- Validation: all 51 focused schedule, guide-routing, connection-handoff and MCP tests pass; whitespace checks pass. The full 1,438-test suite passed before this follow-up and was not rerun for these instruction/default changes.
- No live task configuration, scheduler activation, deployment, or external memory update was performed; these source changes remain uncommitted in the same isolated checkout.
## Profile sidebar follow-up

Changed My Profile to a desktop vertical sidebar, retaining its mobile selector,
lazy-mounted sections, and main's restored Appearance navigation. Added Saved Preferences between
My Agent and Appearance with one explicitly unconnected Muse-summary empty state.
No preference memory, saved answers, or external-agent state is modified.
Focused render tests cover ordering, mobile option, Appearance, and focus styles.
The self-contained layout preview uses the product's existing layout and tokens;
it is not evidence of a hosted deployment or authenticated Muse synchronization.
Validation: 15 focused/adjacent tests, frontend typecheck, static build (441 offline
assets), and catalog validation (158 roles) pass. Desktop/mobile HTML previews
report no console errors; mechanical design scan reports no findings. No hosted
or authenticated browser interaction was tested.

## Local main integration

Before integration, the full suite passes 1,443 tests. Preserved main's restored
Appearance section, application-pickup setup instructions, and workspace-maintenance
guide version. Combined connection-schedules guidance is version 4; the developer
contract is version 169. No external schedule, memory, push, or deployment is implied.
Integrated typecheck/build (442 offline assets), catalog validation, and 55 focused
checks pass. The first integrated full run reports 1,403 passes and 55 failures in
the imported Career Ops paths, including a missing MACOS_BROWSER_LIKE_USER_AGENT
export and vendor-manifest mismatches. Newer local main contains a related export
repair and will be integrated before final landing; no unrelated repair is added here.
After integrating that newer main, 45 of 47 combined feedback/profile/Career Ops
checks pass. The two remaining failures are Career Ops vendor-manifest integrity
and provider loading (106 versus 108). Those vendor files and their test are
byte-identical to imported local main; no changes to them are part of this feature.
