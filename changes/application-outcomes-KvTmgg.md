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
