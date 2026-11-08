# Muse event watcher

- Agent package 0.2.0 polls existing event counts every 60 seconds and retries positive counts after a 60-second cooldown. HTTP/wake failures back off to about five minutes plus jitter by default. Explicit old config values require host updates.
- Versioned agent-package/change-resumption guides document event-triggered wakes, authenticated drain, acknowledgement after verified outcomes, idempotent handling and host serialization/pending-drain responsibility. Developer contract 140; no database redesign or new MCP writer.
- Repair optional change-worker reader validation so Action Board decisions reach read_action_board; AI Apply uses read_backend_jobs.
- Demo coverage: detached AI Apply/Action Board event counts wake without context counters, remain pending after wake and drain only on acknowledgement.
- Validation: npm test (1133 passed, five skipped), npm run validate:data, frontend typecheck, production static-export/package build and git diff --check.
- Limits: host watcher activation, actual Muse wake/browser work and employer submission remain unverified. Existing configure_agent_watch returns a legacy 120-second recommendation; host config explicitly overrides it to 60. No real event acknowledged or job claimed for testing.

Local activation: API image lookout-node:muse-event-watcher-140 is running; connected MCP read-back returned developer140 and agent-package/change-resumption v2. The existing localhost frontend serves the checksummed 0.2.0 archive. WGU remained queued v1 and its Dots Local watch remained disabled for the host handoff. Search worker and Edge runtime were not restarted.

## Follow-up: reachable dev transport

- Serve the existing count handler from Node and generate/serve the checksummed 0.2.0 package in its image. Open only these exact count/package paths in the existing dev tunnel; retain denial of other API routes. Public package downloads do not read private data; scoped MCP configure/read/ack tools remain unchanged.
- Validation: full suite 1135 passed/five skipped, data validation, production static-export/package build and Docker image build passed. Detached transport fixtures cover count and package reads, malformed requests, upstream failure, checksum/size, old archive rejection and host boundaries. Host wake/application work remains unverified.

Live dev activation: lookout-node:muse-public-transport-140 and reloaded tunnel policy serve manifest/archive 0.2.0 (internal version and SHA-256 verified). Public count matched enabled Muse Local watch count 1; missing watch returned 400, unknown watch 0, unrelated routes 403 and unauthenticated MCP 401. No handle logged. WGU remains queued for Dots Local; that connection has no enabled watch, while Muse Local does. No rebinding, claim, outcome or acknowledgement performed. Hosted site/GitHub publication unchanged.

## Follow-up: quiet host-browser work and account setup

- Application guide28/notifications5 and developer141 request silent AI Apply browser preparation, Lookout-first recovery, and no deterministic-platform-only blocker or redundant chat continuation. No submission approval, scope or runtime capability is granted.
- Permit password generation/storage/autofill only through an authorized supported host secure store, with no secrets in Lookout/chat/logs; retain secure human entry when required. Existing authorized mailbox access may handle application-specific verification securely. No vault/mailbox capability is claimed.
- Keep runner registration explicitly paused in guide metadata and shared workflow versions current. Existing fictional demo/read projections use these same guide references; no new account writer or UI action.
- Validation: 1136 full-suite tests passed/five skipped; focused guide/tool/MCP-to-board tests, data validation, production frontend build and local Docker image build passed. Real host compliance and secure vault/mailbox capabilities remain separate.

- Blocker handoff clarification: require report_application_failure or exact draft-question writer, application/Action Board read-back, and a concrete Need your input card before reporting/acknowledging handled work. Existing owner/revision/stop checks and human decisions remain. The Node/MCP/browser integration fixture now covers an agent secure-entry blocker and its matching card/recovery action.

Local activation: API image lookout-node:quiet-browser-141 and refreshed mounted Edge runtime read back developer141, application-workspace28 and notifications5 through the connected MCP. Guide read-back confirms required Need your input handoff and quiet execution. No password was generated/stored and no real application outcome/card/acknowledgement was fabricated by this maintenance pass.

## Follow-up: batch concurrency and Lookout-first recovery

- Application guide29/change-resumption3/developer142 add three general rules: check Lookout before asking, parallelize independent work, and serialize shared accounts/sessions and records. One dispatcher may coordinate multiple workers; existing claim/version/approval safeguards remain.
- Shared guide and detached demo feed references stay current. Full suite, existing focused guide checks, data validation and production build passed; host compliance remains unverified.
- Preserve the existing browser tab/session while waiting when supported, resume the same application, and verify employer draft persistence before claiming safe reopening.

Local activation read-back confirmed developer142/application-workspace29/change-resumption3 after Node image and mounted Edge refresh. The concise concurrency and retained-tab instructions are present. No employer browser session, application state or real claims were changed by this pass.

## Follow-up: one grouped application input card

- Application guide30/developer143 explicitly group unanswered employer fields in one existing application/card, preserve answered fields, label proposals unconfirmed, and require complete-group read-back before notifying. Resolution continues the same application to Submission review.
- Existing prepare_draft/read_application_record/read_action_board paths and detached demo guide references are unchanged apart from the current version; no new writer/UI or per-field task. Validation: full suite 1136 passed/five skipped, data validation, diff checks and local API image build passed.

Local read-back confirmed developer143/application-workspace30 and the explicit grouped-input instruction after API/Edge activation. No real application card, answer or approval was changed. Host compliance and hosted deployment remain separate.

## Follow-up: focused application question review

- Keep the résumé and unanswered/inferred/AI-drafted/unsourced answers on the decision card; move direct sourced facts out of its visible question list while preserving the complete application via the widget. All answers keep original indices in validation/save payloads; existing exact review/approval gates remain. Existing read_action_board/response tools retain their full data and writer boundaries.
- Guide31/developer144 require preserving the full draft instead of pruning saved questions. Demo includes sourced facts alongside proposals and missing answers; browser coverage checks card filtering and full-widget access. Validation: full suite 1137 passed/five skipped; focused disclosure/guide checks, frontend typecheck/build, data validation and Docker image build passed. Desktop/mobile detached-demo interactions verified source filtering, full-widget access, résumé retention, required-answer resolution and exact review; screenshots in /tmp/lookout-focused-card-ui. Mechanical design detector returned no findings. No real-account browser verification.

## Follow-up: stale AI Apply label after recorded submission

- Applications now derives the preparation label from current application/tracker progress, hiding superseded blocked-job warnings without changing historical outcomes. Genuine uncertain submission outcomes remain visible. The existing default Discover filter already excludes submitted roles; regression coverage joins cloud hydration, both page projections and the historical-label case.
- Add a fictional submitted application with an old blocked job to the demo; guide32/developer145 require actual application outcome persistence/read-back rather than manual movement or fake job completion. No new writer, permission or receipt authority. Validation: 1138 full-suite tests passed/five skipped; focused projection/label checks, frontend typecheck/build, data validation and Docker build passed. Desktop/mobile browser regression confirms the submitted row has no stale AI Apply warning; mechanical detector returned no findings.

Local activation: Node image lookout-node:submission-state-145 and refreshed Edge read back developer145/application-workspace32 with focused-card and submission read-back guidance. WGU remains recorded Submitted; its old partial/blocked job is retained unchanged. No real application data/approval/receipt was modified. Hosted release and real-account browser refresh remain unverified.

## Follow-up: stable AI Apply agent selection

- Add owned, version-fenced application routing separate from connection creation time and display name. Website and scoped MCP share selection/queue validation; existing jobs remain bound. Unavailable selected agents fail explicitly instead of falling back. My Agent exposes the choice; fictional demo supports selection without account writes. Workspace reset clears the preference.
- Guide34/developer147 document the simple selection rule. Database coverage checks browser/MCP routing, newer testing connections, ownership, stale selection, unchanged old jobs and revoked-agent failure. Validation and local activation recorded below after checks.

Validation: full suite 1145 passed/five skipped; final focused routing/reset/demo checks passed after adding the reset write fence and demo unavailable-agent check. Frontend production build, data validation (158 roles), Docker build, desktop/mobile detached selector/refresh/unavailable-state checks and mechanical design detector passed. No real application was queued or submitted for verification.

Local activation: migration 20261108081625 applied transactionally without replaying unrelated migration-history gaps; local API image lookout-node:application-agent-147 exposes both scoped tools. select_application_agent and read_application_agent saved and verified Muse Local as the account default (routing version1, available). The live resolver confirmed Dots-initiated requests resolve to Muse without creating work. Dots permissions, existing WGU job/application and watcher configuration were unchanged. Hosted publication remains separate; real-account browser selector interaction was not exercised.
