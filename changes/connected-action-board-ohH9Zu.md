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
