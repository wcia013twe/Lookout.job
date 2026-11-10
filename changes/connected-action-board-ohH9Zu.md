# Connected Action Board and canonical interview prep

- Preserved desktop framing, rows and review dialogs; added deterministic human questions, Accept/Reject controls and equivalent mobile touch swipes. Exact saved application/message review precedes acceptance; required input and uncertain submissions retain their owning flows.
- Registered new decision receipts and work holds with the existing workspace reset and reset write fence, preventing stale consent or suppression after a reset.
- Added owner-scoped board projection, source/version review and response receipts, idempotency, exact human-action links and a gated read-only MCP counterpart. Answer links open the actual expanded My Agent question bank. Outreach acceptance means ready for the human to send, never sent.
- Application rejection keeps history/tracker state, invalidates review, cancels queued work and fences draft preparation, queueing and runner prefill/claim/start. Only a version-checked human Resume lifts the hold; prior approval stays invalid. Declined outreach cannot be automatically rewritten.
- Canonical rounds retain stable IDs across corrections, explicit practice category/timezone, proposed-time confirmation and cancellation. Round tasks share the existing versioned plan/session ledger; rescheduling preserves IDs, completed work and credit. Legacy association requires one exact confirmed-date match. Round resource authoring derives dates instead of duplicating them.
- Added fictional connected-flow demo (`?demo=1&demoApi=action-board`), source/SQL/upgrade tests and desktop/mobile browser acceptance script. The existing planner and company follow-ups keep their presentation.

Validation on the integrated source: `npm test` passed (1048 passed, 5 skipped; 1053 total), `npm run validate:data` passed (158 roles), `npm --prefix next-app run typecheck` passed and `npm run build` produced the static export. The connected-board desktop/mobile browser script passed against that production export, covering exact review, answer/outreach navigation, canonical cancellation, actual touch scrolling/swipes and version-checked stop/resume. Upgrade tests preserve completed tasks and partial credit while leaving ambiguous matches standalone. The design detector reported no findings. `git diff --check` passed.

The final Network filter follow-up was checked with 20 focused network/import/connected-board tests, frontend typecheck and another production build.

The final guide-only networking merge preserved both canonical sources at cold-outreach v9; all 15 focused outreach/context/MCP tests and the final production build passed.

Integrated current local main without dropping its search/toolkit/import changes. The combined agent contract is 120; guide routing retains the current canonical versions. Screenshots are in `/tmp/connected-action-board-ui/`.

Limits: checks use disposable migrated databases and fictional detached browser state. No account writes, employer submissions, message sending, hosted deployment or real-client verification occurred. Migration plus gateway/MCP production release and an authenticated hosted check are required before claiming deployed parity. The temporary preview used port 3107 and was stopped; existing local services were untouched.

## Follow-up: filled applications and application next actions

- Extend the shared owner-scoped board read with populated Draft applications,
  Approved applications awaiting submission, and imported `needsAction` records.
  Existing blockers and submission uncertainty retain precedence. These rows use
  owning editors with no fabricated binary decision or second workflow status.
- Add exact imported-record links, preserving selection across tracker deduplication.
  Completed/archived/terminal imported actions disappear based on their source.
- Extend fictional connected-board fixtures and source/ownership/resolution checks.
- Validation: full `npm test` passed (1,059 passed, five skipped); focused SQL,
  board/demo tests, data validation (158 roles), frontend typecheck and production
  build passed. The expanded desktop/mobile production-export flow passed,
  including imported-editor save, board return, resolution, keyboard and swipes.
  Desktop screenshot review preserved existing framing.
- Applied only migration `20261108004208` to the existing local backend. Application,
  imported-record and decision-receipt counts remained unchanged. Owned board reads
  succeeded for both local accounts; the eight flagged imported actions now appear.
  No account actions were accepted, submitted, sent or modified. No push or hosted
  deployment occurred; browser sign-in to a real account was not exercised.

## Follow-up: referenced inline action cards

- Use Impeccable's Operate guidance within the existing board and Weekly Prep
  framing. Give drafts, questions, messages, interviews, task actions and
  verification requests distinct content layouts and Circles-style @ object links.
  Remove Imported provenance tags. Every decision card has a check and red X with
  accessible, action-specific names.
- Put required answer fields, reuse settings, résumé selection, exact review and
  verification evidence in the cards. Disable acceptance until prerequisites are
  met. Save edits before reviewing/approving a new revision; preserve the durable
  work stop on rejection. Task decisions clear the existing needsAction field.
- Extend the shared owned projection and authenticated response RPC, retaining
  source locks, stale rejection, idempotency and existing domain validators.
  Agent read parity remains read-only; no human confirmations can be forged.
- Update fictional fixtures and inline browser interactions.
- Validation: integrated `npm test` passed (1,074 passed, five skipped), data
  validation (158 roles), frontend typecheck and production build passed. Expanded
  desktop/mobile browser checks passed, including source references, required-field
  gates, exact review, inline resolution, keyboard decisions, scroll/swipe separation
  and the current seven-day calendar. Forty focused combined guide/calendar/board
  tests passed. Impeccable detector returned no findings; desktop/mobile visuals
  were inspected in the incumbent theme system.
- Integrated current local main's calendar and Network work without discarding its
  behavior. Combined developer contract is 129; application-workspace guide 21.
- Applied only migration `20261108005642` to the existing local database. Hashes of
  application, imported-job and decision-receipt records remained unchanged. Both
  owned inline board reads succeeded (14 and 11 pending items). No real decisions,
  submissions or outreach were performed. No push or hosted deployment; real-account
  browser sign-in and hosted MCP activation were not exercised.

## Follow-up: action-type borders and materials

- Add full borders and spaced, colored action surfaces using the Career Toolkit
  workspace palette. Applications are blue; questions lavender; interviews green;
  outreach cyan; blockers/uncertainty amber; task actions slate; submission reports
  sage. Match ink, secondary text and internal dividers to each light/dark material.
- Preserve inline form/review controls and board/Weekly Prep placement. Remove the
  extra question-box fill now that its containing card owns the material.
- Verification: `npm test` passed (1,074 passed, five skipped), data validation
  passed (158 roles), typecheck and production build passed. The desktop/light
  and mobile/dark views show seven distinct materials with full 1px borders,
  stable focus backgrounds and no horizontal overflow. Existing inline decision,
  calendar and mobile-swipe browser checks passed; Impeccable detector returned
  no findings. No backend changes, real-account writes or hosted release.

- Landing integration preserved the subsequently landed upcoming-date calendar.
  Nineteen focused calendar/board tests, frontend typecheck, production build and
  the updated desktop/mobile interaction flow passed on the combined source.

## Follow-up: real application previews and event-only corrections

- Embed Circles' actual JobAttachment component for referenced applications,
  including company identity and shared progress stages. Keep the owning details
  link secondary and retain type-colored cards and inline decisions.
- Scheduled interviews are calendar context unless their owning record explicitly
  requests human work. Update the agent guide and fictional event-only fixture;
  protect explicit assessment/time-confirmation tasks in source-based tests.
- Corrected three incorrectly flagged event-only records through the existing
  scoped MCP tracker mutation. Read-back verified that only needsAction changed;
  five genuine tasks remain flagged. Round details, dates and hiring status were
  preserved. No application approvals, submissions or outreach occurred.
- Verification: `npm test` passed (1,085 passed, five skipped); 33 focused
  board/guide/MCP checks, data validation (158 roles), frontend typecheck and
  production build passed. Desktop/light and mobile/dark screenshots verified the
  shared Circles preview; browser checks cover preview stages, event-only exclusion,
  inline forms/review, upcoming dates and mobile scrolling/swipes. Impeccable
  detector returned no findings. No hosted release.


## Follow-up: unblock notifications and filled drafts first

- Add reusable ActionAttention dot/count for human blockers, missing answers,
  uncertain submissions and drafts missing required answers. Show it in existing
  navigation and affected card headers; show the input count above the list.
- Stably move filled application drafts to the top. Do not confer review or
  approval; keep owning-record receipts and submission distinctions unchanged.
- Existing fictional connected-board fixtures exercise notification appearance,
  resolution and draft-first ordering. Existing read_action_board MCP boundary
  supplies these same source decisions; no new service, writer or delivery channel.
- Verification: full `npm test` passed (1,100 passed, five skipped); focused board tests, data validation (158 roles), frontend typecheck and production build passed. Desktop/mobile fictional browser checks verified draft-first order, navigation/card dots, resolution, required fields, keyboard access and swipes. Screenshot review preserved the existing two-column desktop layout. No hosted publication or external notification delivery.


## Follow-up: preview unblock examples in the ordinary demo

- Enable connected Action Board fixtures in ordinary demo mode, retaining
  explicitly selected scenarios. Add fictional CAPTCHA and submission-timeout
  examples alongside filled drafts and missing answers; preserve input gates and
  in-memory reset. Uncertain attempts take precedence over draft review.
- Verify pending resolution and reset through detached services and the default
  desktop/mobile demo route. No production service or MCP contract changed.
- Verification: 18 focused tests passed; full `npm test` passed (1,101 passed, five skipped); data validation (158 roles), frontend typecheck and production build passed. Desktop/mobile browser checks passed on the ordinary demo route, including required input gates, CAPTCHA resolution, uncertain-submission recovery, notification removal, keyboard controls and mobile swipes. No account writes or hosted publication.


## Follow-up: separate discovered-role widget

- Replace Discover's decorative role face with a compact opportunity widget:
  small company identity, role title, job facts, fit summary and existing actions.
  Keep match details expandable and retain the existing grid, preview and queue
  writers. Application references retain their separate progress-stage widget.
- Uses existing demo discoveries (including Example Query Labs) in both themes.
  No domain service, data, approval or MCP behavior changes.
- Verification: final combined-source checks below cover this widget; desktop/mobile screenshots and queue/keyboard preview interactions passed.


## Follow-up: Submission and Need your input review design

- Both application card families reuse the compact Discover role widget.
  Show saved résumé name/version, employer questions, AI-drafted/inferred answer
  sources, other inferred details and unknown provenance without guessing.
- Source disclosures travel with the existing owned draft. Extend the read
  projection for inferences/cover-letter source, preserve them through browser
  sync, and label compact agent answer updates as AI-drafted. Human receipts
  remain authoritative; these labels cannot confer verification or approval.
- Application guide25/developer137 explains one writer/read-back flow with no
  duplicate board post. Add fictional direct-source, generated and inferred
  examples. Preserve the concurrently landed communication widget.
- Verification: full `npm test` passed (1,107 passed, five skipped), including owner-scoped SQL web/MCP read parity; 56 focused guide/board/demo tests and disclosure/sync tests passed. Data validation (158 roles), frontend typecheck and production build passed. Desktop/light and mobile/dark checks covered labels, résumé versions, source disclosures, CAPTCHA/uncertainty resolution, exact review, communication editing, keyboard access and swipes. Compact-widget screenshots verified the matching application material and readable mobile labels. New projection/guide changes require backend release for
  hosted availability; legacy provenance is not fabricated or backfilled.

Saved label refinement: widgets display the existing stored fitLabel when
present, otherwise saved recommendation.priority. No score-to-label inference
or new classification state. Demo includes Strong fit and priority fallbacks.


## Follow-up: one production change-feed pipeline

- Consolidate human decisions/native approvals and AI Apply into the existing
  owned change feed and count watcher; preserve per-connection acknowledgements,
  pointer-only privacy and idempotency. AI Apply retains its existing backend job.
- Tracker approval keeps needsAction pending. Extend the existing decision ledger
  with exact-source audit/pickup/outcome receipts; add scoped MCP progress reporting
  with version, owner and single-connection fences. No parallel editable sheet.
- Rejection survives edits, cancels queued matching jobs and fences further work.
  Reopening is human-only and needs verification for blocked/uncertain outcomes.
  Preserve late real outcomes without clearing new tasks or granting submission.
  Do not reinterpret legacy Done/Dismissed receipts as approvals.
- Show lifecycle in the normal Action Board. Detached fixtures cover the same
  pipeline, AI Apply feed pointers, progress and reset; demo-only buttons cannot
  impersonate an agent in real accounts. Contract138/application guide26 describes
  this flow and coordination with existing workers.
- Verification: full `npm test` passed (1,117 passed, five skipped); 38 focused board/MCP/guide tests and the SQL/demo lifecycle checks passed. Data validation (158 roles), frontend typecheck and production build passed. Desktop/mobile browser checks verified approval stays pending, Muse pickup and completion, required input, stops, source labels, keyboard access and swipes. SQL checks cover replay, feed privacy/counts/acknowledgements, owner/scope isolation, single-agent claims, rejection across edits, AI Apply queue events/cancellation and late outcomes. Hosted migration/gateway/MCP release and authenticated
  host wake verification remain separate; no account decisions or submissions
  were made as part of development.

- Local activation (2026-11-08): landed in main at 35310de9. Applied the four
  missing watcher/schedule/disclosure/pipeline migrations to the local stack,
  preserving hashes of existing account records. Rebuilt and replaced only the
  local API image; retained the existing worker and its jobs. Reloaded the local
  Edge runtime. A disposable authenticated account verified human approval →
  feed → MCP pickup/completion → acknowledgement, with watcher count 0 → 1 → 0.
  AI Apply emitted exactly one feed event in a transaction rolled back before
  worker visibility. Disposable account removed; real decisions untouched.
  Merged Discover checks and frontend typecheck passed. No push or hosted release;
  the user's actual Muse host wake was not tested.

## Local Muse tool activation (2026-11-08)

- Applied committed migration 20261108050816 locally, with existing account
  record hashes unchanged. Built API image lookout-node:muse-requests-c7d8534a,
  replaced only the local API and reloaded the Edge runtime.
- Connected MCP discovery exposes claim_application_request and
  report_application_request. A disposable authenticated account exercised the
  shared human queue writer, MCP claim and a blocked outcome, alongside the
  approval/feed lifecycle. All passed; disposable account removed. No real
  approval, employer action, host wake or hosted release was performed.
