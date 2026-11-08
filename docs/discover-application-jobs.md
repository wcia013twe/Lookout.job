# Discover application requests

**AI Apply → existing change feed → Muse pickup → host browser work → saved outcome.**

Discover's AI Apply calls `queueApplicationJob` / `queue_application_job` (`applications.submit_job`). The existing closed SQL helper validates the selected HTTPS posting, current application revision, owned profile and active scoped connection. It creates/reuses the application and a connection-bound queued job (legacy kind `application_submit`). Active requests deduplicate; exact retry keys replay their original receipt. Opening a posting is separate and does not apply.

The job insert emits one idempotent `application_requested` pointer in the existing Muse change feed. The count-only watcher sees it; the external host still supplies polling, wake delivery, computer use and optional subagents. Reading/acknowledging the feed grants no permission and never marks work complete. Current queued roles show **Waiting for Muse**; a successful pickup shows **Muse is working**.

Muse follows the pointer to `read_backend_jobs`, reads `read_application_record`, and calls `claim_application_request` (`applications.request.claim`) with jobId, expectedVersion, current application expectedRevision and a stable eventKey. Only the request's bound active scoped connection can claim it. Single pickup, revision checks, existing attempts and human work holds are enforced in SQL. There is no expired-lease takeover: an interrupted running request must be reconciled, never duplicated. Keep one agent/browser writer per application.

The assigned agent reuses the saved draft and materials, opens the actual employer form using authorized host computer use, fills it, checks the live fields and resolves supported mistakes. Optional subagents need working host browser/connection access; a request does not establish that capability. The backend does not transfer a browser session or run an LLM. Save supported draft corrections through existing versioned writers and read them back. Missing facts, CAPTCHA and unavailable execution/authorization capabilities become explicit saved blockers. Human edits and exact-version approval rules remain authoritative.

After saving the application work, `report_application_request` (`applications.request.report`) records prepared/completed/blocked/uncertain, a factual summary and the current job/application versions. This updates the existing job projection and emits the existing `backend_job_finished` pointer. Prepared means ready for review; completed means agent task finished. Neither creates approval, submitted status, a submission attempt or a verified receipt. Actual application progress and evidence retain their existing writers and source distinctions. Uncertain external outcomes require human verification and must never automatically retry. Acknowledge the original request only after a saved and verified outcome/blocker.

## Deterministic browser execution is temporarily paused

The production worker's `createApplicationExecutor` import/hookup and Node API submission-tool registration are commented out. The local runner's inspect/try/submit tool registrations are also commented out; implementations remain in source and focused fixtures can exercise them explicitly. `LOOKOUT_SUBMISSION_ENABLED` does not reactivate these registrations. Search workers continue normally. SQL `claim_application` returns no work, rejects worker submission claim/start, and refuses worker access to Muse-owned jobs. A pre-existing started deterministic attempt may still save its true finish; disabling new pickup must not discard its outcome.

Required approvals, policy/ownership checks, durable stops and uncertainty handling remain in force. Computer use is not an authorization bypass. Muse's standing host restrictions are independent of Lookout configuration; if no supported authorized submission/evidence path is available, it must stop with a blocker. No real employer action or external agent wake has been established by repository fixtures.

## Parity, demo and release

Website queueing and MCP `queue_application_job` share the same SQL writer. Agent-only pickup/report tools route through `backend_job_dispatch` from both Edge and Node with the same closed validation and connection/version checks. There is no human impersonation endpoint. The website reads the existing `execution_job` projection; no new workflow table or browser credential is introduced.

The detached demo uses memory-only queue/pickup/outcome services and explicitly labelled Demo controls. It never opens employer forms, reads private files or submits. Reset removes simulated requests and outcomes.

The migration, gateway/MCP release and rebuilt Node runtime must all be activated in the intended environment, and Muse must refresh developer context/tool discovery (application-workspace v27 / developer139). Local-main landing or a static frontend build alone does not activate the backend or verify the watcher/browser host.

Muse request intake accepts HTTPS posting URLs independently of deterministic adapter support; the old provider allowlist is commented out. This only queues agent work; deterministic submission platform support and approval/receipt authority are unchanged. Queue failures display the backend message, including plain-object RPC errors.
