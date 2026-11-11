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

The migration, gateway/MCP release and rebuilt Node runtime must all be activated in the intended environment, and Muse must refresh developer context/tool discovery (application-workspace v32 / developer145). Local-main landing or a static frontend build alone does not activate the backend or verify the watcher/browser host.

Muse request intake accepts HTTPS posting URLs independently of deterministic adapter support; the old provider allowlist is commented out. This only queues agent work; deterministic submission platform support and approval/receipt authority are unchanged. Queue failures display the backend message, including plain-object RPC errors.

AI Apply authorizes quiet host-browser preparation without an extra start message. Consult current Lookout facts before asking for missing information; employer platform alone is not a blocker. Authorized host password-manager and mailbox capabilities may resolve account setup/verification securely; unsupported or human-only steps remain explicit blockers. No secrets enter Lookout records or notifications. Existing exact-version submission approval and host restrictions remain in force.

A real blocker must be saved on the owning application with report_application_failure (or exact missing draft questions), then read back in read_application_record and read_action_board as Need your input. A blocked job summary alone does not satisfy this handoff. Reporting the job uses the post-blocker application revision; acknowledgements follow verified persistence and card projection.

One dispatcher may coordinate parallel independent applications with separate browser sessions. Serialize shared employer accounts/sessions and records, keep one owner/writer per application, and retain existing claim/version/approval safeguards. Workers check current Lookout facts and application state before asking the user for information.

While waiting, retain the existing browser tab/session when supported and resume the same application. Verify employer-side draft persistence before relying on reopening; no automatic session-retention guarantee is implied.

Group all unanswered employer fields for one application into its existing draft.questions and one Need your input card. Verify the complete group before notifying; proposals remain unconfirmed. When resolved, continue the same application to Submission review. Do not create per-field tasks or a duplicate application.

Application cards retain the résumé and show unanswered, inferred/AI-drafted or unsourced answers for review. Direct profile/saved-answer/preference facts remain in the full application through its widget. Filtering is presentation-only: the complete ordered answer set still participates in validation, versioned saves and exact review. The MCP read_action_board projection retains all questions.

Actual submission must be persisted on the application through its existing progress/evidence writer, then read back. Recorded applied/later progress automatically hides the role from default Discover and places it in Applications; the explicit applied-history toggle remains available. The tracker suppresses stale preparation-job labels after later progress while retaining unresolved submission uncertainty and historical job records.

## Final preparation transaction

`finalize_application_request` maps to `applications.request.finalize` on both queue dispatch paths. Supply `jobId`, `expectedVersion`, `expectedRevision`, `eventKey`, a complete `finalDraft` with `questions`, `browserInspected`, `outcome` (`prepared`, `blocked`, or `uncertain`) and `summary`; blocked/uncertain require `blocker`. Prepared requires inspected browser fields, no blocker and no unanswered required question. Use incremental `prepare_draft` for prefilling first.

The existing job journal transaction validates the active credential, scopes, connection ownership, running Muse request, versions and stop fences; calls canonical `drafts.prepare`; records the request outcome; and saves its replay receipt. Failure rolls back the draft and job together. The response contains the persisted application and its scoped `actionBoardItems`; inspecting complete results replaces immediate duplicate reads. Missing/inconsistent results still require reads. Claim also returns its saved application and compact handoff without a second personal-context fetch.

Identical keyed retries return historical results after current access checks. Changed payloads conflict. Human review, approval, submission evidence and event acknowledgement remain separate. Finalization uncertainty describes preparation, not a new submission receipt. Keep factual `report_application_request` for separate reports/recovery and never rewrite an unchanged approved draft merely to close work. No automatic executor or new workflow store is introduced. These are local source contracts until the migration and gateway/MCP are deployed and verified.
