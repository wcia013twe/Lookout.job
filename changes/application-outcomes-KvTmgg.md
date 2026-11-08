# Editable imported application outcomes and job types

- Imported tracker history now represents Saved, Applied, Screen, Interview, Offer, Rejected, Withdrawn and Posting closed independently from archiving. Duplicate reports prefer outcomes, then known status recency, and retain an explicitly reported applied date.
- Reuses settings employment types (FT, Internship, Part-time, Contract, Temporary) in CSV parsing, the Applications filter, editor and simple settings selector. The static discovery catalog remains unchanged.
- Adds website editing and scoped `update_imported_job` (`imports.update`) through the shared owner-scoped import writer, row validation, tracker version lock and stable event-key replay. Source rows stay intact. Supports explicit corrections to type, status, title, location, dates, notes and archive state; never creates approvals or verified receipts.
- Updates Muse maintenance guide v3, developer contract 111, workflow references and OpenWiki. Existing imported statuses/notes are not inferred or rewritten.
- Demo: fictional rejected Part-time fixture plus versioned corrections; verified import, Contract/Interview edit, read-back, Contract filter and Closed visibility on desktop/mobile. Screenshots inspected; no horizontal overflow or page errors. Mechanical design detector returned no findings.
- Validation: `npm test` passed (1006 passed, 5 skipped), including database scenarios; focused import/MCP/workflow tests passed; frontend typecheck, production build, `npm run validate:data` (158 roles) and `git diff --check` passed. An initial guide-version mismatch was corrected; the final full run passed. Service-role regression emulates hosted BYPASSRLS in the fixture and verifies the actual execute boundary.
- Local Dev: applied only migration 20261107190957 to lookout-local, recording it atomically and verifying the existing imported-row fingerprint was unchanged. No other pending migrations, account records, Docker restarts or hosted changes were performed. Existing authenticated connection answered with personal 119 / developer 110 before source landing.
- Limits: browser verification used isolated fictional demo state; no real application outcomes were corrected. Hosted migration/function deployment and authenticated Muse verification of contract 111 remain separate release checks. Five existing suite tests are skipped; no real employer submission was exercised.

## Follow-up: restore the original application interface

- Removed the separate imported row/editor. Imports now open the original
  application detail dialog and use the native compact row, progress bar,
  Overview/Documents/Interview sections, round/email history and Notes panel.
- Retains original source notes as explicitly imported reports with only known
  dates. Notes never become fabricated email links or override current status.
- Intentionally leaves backend mismatch visible, as requested: imported records
  have no native application ID; round writes fail with the existing sync error,
  and native workflow mutations show an unsaved error rather than creating ghost
  applications or approvals. Existing MCP metadata correction remains available.
- No backend schema or runtime deployment is part of this follow-up.
- Follow-up validation: 24 focused import/timeline/progress tests passed; frontend
  typecheck, production static build, catalog validation (158 roles), diff check
  and mechanical UI detector passed. Desktop/mobile demo verified the original
  imported row/progress, native dialog tabs, vertical progress, Notes and email
  history, plus the intentional unsaved timeline error. No horizontal overflow
  or page errors. Full backend suite was not repeated for this UI/read-model pass.

## Follow-up: clarify fit, prep, documents and context

- Always shows the four saved fit dimensions in application Overview; missing
  scores are N/A and real zero scores remain zero. Added a clearly fictional
  saved assessment with one missing dimension to the resettable demo.
- Current prep links to Interview brief and Toolkit workspace. Notes provides
  two recent distinct context snippets with expandable text. Trimmed repeated
  captions, empty-state instructions and redundant preparation/status copy.
- Documents displays only captured historical employer fields and pinned resume,
  with expandable answers. Missing historical snapshots show Not available;
  imports explicitly identify outside-Lookout submissions. Imported Saved roles
  never claim they were submitted. Current profile/draft data is not substituted.
  Native unsent drafts remain clearly labeled; raw evidence stays optional.
- Validation: 33 focused assessment/document/submission/demo/progress tests passed,
  including new rendered privacy/provenance checks; frontend typecheck, static
  production build, catalog validation (158 roles), diff check and UI detector
  passed. Desktop/mobile demo verified missing/saved fit scores, prep links,
  external missing documents, confirmed captured answers and no overflow/errors.
- Limits: no Scale AI private record was edited, no missing scores or submitted
  answers were invented, and no backend/schema/runtime change was needed. Full
  backend suite was not repeated for this presentation-only pass.

## Follow-up: date ordering on Active applications

- Active now groups screening/OA, interviews/onsites and offers above applications
  awaiting a response. Each group sorts newest recorded application date first;
  undated records follow dated records and ties remain stable.
- Uses existing applied/submitted dates, current submission milestones and an
  opened-date fallback. Future interview dates do not reorder application dates.
  Native, tracker-only and imported progress share the same rules. Other tabs
  keep their existing ordering; no account or catalog data is changed.
- Demo verification reuses the existing fictional native/imported dated records,
  advanced stages and resettable state; ordering never persists or mutates them.
- Validation: 19 focused sorting/timeline/progress tests passed, including a
  resettable mixed native/import demo read; frontend typecheck, production static
  build, catalog validation (158 roles) and diff check passed. Backend/data writes
  are unchanged; no new visual layout or backend deployment is involved.

## Follow-up: Needs action application flag

- Application rows show a compact Needs action flag and the recorded reason for
  due, unresolved application inbox handoffs. Opening it uses existing details;
  resolved/future handoffs stay unflagged, and deferred actions refresh when due.
- Flags remain separate from hiring stages and existing Active date ordering.
  They read existing review/blocker/submission-check records shared with Action
  Board and MCP read_action_inbox. No new write path, manual task flag, inferred
  recruiter request or imported-record backend connection is advertised.
- Added a fictional review handoff to resettable demo data and tested its
  isolated resolution/reset. Demo approval remains intentionally disabled.
- Validation: 12 focused inbox/flag/sort tests, frontend typecheck, production
  static build, catalog validation (158 roles), diff check and UI detector passed.
  Desktop/mobile demo checks confirmed visible reason, detail opening, no page
  errors or horizontal overflow. No backend/schema change; full database suite
  was not repeated for this read-only UI pass.
- Local-main integration preserved concurrent Career Toolkit/test-harness work;
  after resolving the documentation append, all 11 remaining focused tests,
  frontend typecheck and static build passed again (the consolidated harness
  moved one earlier demo assertion into its shared fixture coverage).

## Follow-up: optional next action date and sort

- Application rows show a dated next round or confirmed unfinished preparation
  deadline beside any independent Needs action flag. Unknown dates stay blank.
  Current scheduled rounds own their timing, avoiding duplicate/stale prep dates;
  completed, superseded, terminal and archived records do not create reminders.
- Active keeps its progress/date default and adds Sort → Next action date.
  This optional order uses earliest pending date first, undated last, with stable
  default ordering for ties. No automatic priority rules or new task store.
- Reuses scoped timeline/preparation records and existing website/MCP writers;
  dates remain editable through Add round / Confirmed date & time, with existing
  corrections/completion. Uses one planner read with owner/reset/race guards and
  refresh on cloud-ready/focus/reconnect. Failed reads are reported explicitly.
- Demo coverage uses existing fictional confirmed, unknown, rescheduled and
  undated application states; added an interaction test for recording, moving,
  completing and resetting a next action through the isolated milestone writer.
- Validation: 17 focused next-action/display/inbox/sort tests, frontend typecheck,
  production static build and catalog validation (158 roles) passed. Desktop and
  mobile preview verified the optional sort/default restore, flagged dated row,
  detail opening and no page errors/overflow. UI detector/diff checks passed.
- Limits: this is a read-only list feature, with no schema/writer change or new
  arbitrary task/deadline field. Imported records retain their existing native
  workflow mismatch. Full database suite and live account/deployment verification
  were not repeated for this presentation/read-only integration.

## Follow-up: compact search toolbar

- Consolidated search, type, stage and Active sort into a single desktop toolbar.
  Replaced oversized boxed selectors and the separate Sort row with lightweight
  native selects: All types, All stages, Progress / Next action. Search stays the
  primary input; mobile places the three controls directly below it.
- Existing filter/sort values, default ordering and accessible names are retained.
  Controls keep 44px interaction targets and native keyboard/dropdown behavior.
- Validation: frontend typecheck, production static build, UI detector, catalog
  validation (158 roles) and diff check passed. Fictional desktop/mobile preview
  exercised search, type/stage filters, Clear filters and action sorting, and
  confirmed single-row desktop layout, mobile targets and no overflow/page errors.
- Presentation only: no domain/backend/data changes or new tests; full backend
  suite and live deployment verification were not repeated.

## Follow-up: imported action fields and explicit stage completion

- Extends the existing imported-record update writer with nextAction/actionDate,
  needsAction and completedStages. Dates may be null; candidate actions are
  separate from waiting for employer response. Completion never advances the
  current stage or creates verified submission/approval evidence.
- Browser Overview → Tracking details and scoped update_imported_job use the same
  owner checks, tracker version, validation and stable replay keys. Future or
  duplicate completed stages, invalid dates/flags and unnamed dated actions are
  rejected. Original source rows/notes and omitted fields remain unchanged.
- Imported dates/flags feed existing row indicators and optional date sorting;
  explicit completed stages show check marks on the original progress bar.
- Incremented developer contract to 116, application-workspace guide to 15 and its
  change-feed reference. Guide explains exact fields, null/clear semantics,
  preserving prior completions, date confirmation and read-back before success.
- Fictional demo uses the same pure field validator. Added SQL browser/MCP parity
  and isolation/version/replay tests, import-to-row/render checks, and an editor
  interaction verifying save/read-back, clear and disabled future completions.
- Validation: full integrated suite passed (1,018 passed, 5 pre-existing skips),
  including all SQL scenarios; 34 focused import/action/context tests and 25
  contract/guide/version tests passed. Final typecheck/static build, data
  validation (158 roles), UI detector and diff checks passed. Desktop/mobile demo
  exercised saved action/date/flag/completion and clearing without account calls.
- Concurrent local-main integration already used developer 115, so this feature
  advances to 116 to ensure clients refresh discovery; the guide remains 15.
  Initial sandbox HTTP failures required loopback-enabled execution; the complete
  integrated rerun passed without suppressing tests.
- Dev activation verified: applied only migration 20261107211643 atomically with
  its ledger entry, verified private validators are not executable by anonymous
  or authenticated roles, built a separate committed-source dev API image and
  reloaded local Edge. Existing worker/network/tunnel remained in place. The
  connected MCP reports developer 116, discovery exposes nextAction/actionDate/
  needsAction/completedStages and application-workspace guide 15 reads back.
  No personal imported data/notes were modified. Production still requires the
  normal reviewed-main backend workflow; this is a dev availability claim only.

## Follow-up: green completed progress for every application

- Previously only imported explicit completedStages values drew checks, so CTC's
  recently saved completion stood out while other already-passed stages had none.
  Now earlier stages, recorded opened links and reported Applied/Submitted steps
  receive green checks/connectors. The current screening/interview/offer stays
  pending unless explicitly completed; shared-stage-only displays remain scoped.
- Imported Tracking details checks/disables already-passed steps consistently,
  while keeping explicit current-stage completion editable. Rendering does not
  change personal records, completion flags, hiring status or submission evidence.
- Fixed a related display bug where a synthetic Phone Screen timeline entry
  incorrectly raised progress to Interview, which would falsely complete Screen.
- Validation: 22 focused tracker/import/render/sort/timeline tests passed;
  frontend typecheck/build, catalog validation (158 roles), detector and diff
  checks passed. Existing fictional native/import demo coverage verifies completed
  earlier steps and explicit current completion; desktop/light/dark and mobile
  detail checks confirmed green connectors/checks and an unfinished current round,
  with no page errors or overflow. No schema/MCP writer/runtime change; full DB
  suite was not repeated for this presentation pass (focused import SQL passed).

## Follow-up: purple bar, green checkmark only

- Per visual correction, progress connectors, reached circles and current-stage
  rings stay purple. Only the checkmark glyph is green, with a light green that
  remains legible against the purple circle in light and dark themes.
- Completion logic and saved records are unchanged. Existing fictional progress
  demos cover the styling; desktop light/dark and mobile detail inspection
  confirmed the exact colors, no page errors or overflow.
- Validation: production static build, UI detector, catalog validation (158 roles)
  and diff check passed. No new tests or backend suite for this CSS-only change.

## Follow-up: restore the softer original lavender

- Restored the existing lavender shade (#a78bcb) for progress bars/circles instead
  of the darker replacement purple. Kept the glyph green, using a dark green for
  legibility inside the lighter lavender circle. Completion/data behavior stays
  unchanged.
- Production build, catalog validation (158 roles) and diff check passed. The
  fictional application preview confirmed the original lavender color and green
  glyph in computed styles and screenshot. No backend change or new tests.

## Follow-up: dynamic employer rounds and shared chart/Muse counts

- Adds typed Screen/Interview rounds (OA, take-home, technical, system design,
  behavioral, hiring manager, onsite, recruiter, other) with custom names and
  pending/scheduled/completed/cancelled states. Existing native milestones and
  imported record.rounds are the only saved sources; there is no count store.
- Shared applicationRounds/applicationRoundStats drive UI round lists, progress,
  next dates, Stats and scoped read_application_round_stats. Native corrections
  count once; no synthetic status, note or activity-text rounds. Unique jobs stay
  separate from round counts, using the board's native/import duplicate rule.
- Existing native milestone writer gains optional round metadata under its owned
  evidence/replay/replacement boundary. Imported full-list edits keep stable IDs,
  global tracker version and exact retries, and advance earlier active status to
  the explicit round stage without touching terminal outcomes or inventing Offer.
- Native editor supports type/stage/cancellation and replacement prefill. Imported
  Interview links to the working Tracking details round editor; its rounds can
  be added/reordered/edited. Current-stage checks follow saved round phases.
- Contract 121, application-workspace 16 and interview-preparation 6 document
  canonical round fields, count/read-back rules and employer-round vs prep/mock
  distinctions. Change-feed workflow references match the guide versions.
- Added real SQL browser/MCP parity, owner/version/replay and shared-counter tests,
  rendering/count unit checks, and a resettable mixed-state round demo. Initial
  broad suite had 1,040 passing, 5 skipped and one expected catalog-size assertion;
  the assertion was updated for the new supporting read tool and focused tests
  passed. Final integrated validation and runtime receipts follow below.
- Final integrated verification passed: full npm suite 1,045 passed / 5 existing
  skips, frontend typecheck/static build, catalog validation (158 roles), detector
  and diff check. Desktop/mobile demo exercised adding a Screen take-home,
  completing it without an Interview promotion, adding a real Interview round,
  saving its date and reading the distinct round/application totals in Stats.
- Local-main integration preserved the newer private Discover handoff guide and
  its version 15 while retaining round guide versions 16/6 and contract 121.
  No personal records were migrated from notes; runtime activation follows the
  committed source and is recorded separately below.
- Integrated the concurrent Connected Action Board implementation, preserving
  native stable round IDs, practice categories/timezones, confirmation, cancellation
  and round-linked prep. The round migration now extends its underlying writer
  instead of replacing that wrapper. Corrections/confirmation preserve stage/type
  when omitted; cancelled phase and unconfirmed dates use the same projection.
  Updated workflow references to application-workspace 17 / interview-preparation 7.
- Hierarchy remains Applied → Screen → Interview → Offer, with each employer's
  ordered rounds nested inside those broad phases. Source changes do not invent
  rounds from notes or backfill personal records.
