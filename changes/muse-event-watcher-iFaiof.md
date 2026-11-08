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
