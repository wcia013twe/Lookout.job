# Lookout architecture figure

This is a simplified logical architecture, not a deployment inventory or a claim
of measured agent improvements. The current layout consolidates the interface
and workspace into one Lookout boundary. It shows two parallel paths:

- Human -> Web UI -> Backend -> Supabase.
- Personal agent -> MCP tools -> Backend -> Supabase.

The agent does not operate through the web UI. Both interfaces access shared
workflow records and domain rules. Scheduling/wake support belongs to the agent's
runtime and is grouped with the personal agent, rather than drawn as another agent.

## Files and editing

- `lookout-architecture.drawio`: native editable diagrams.net XML.
- `lookout-architecture.svg`: vector preview with the native XML embedded.
- `lookout-architecture.pdf`: one vector landscape page for LaTeX `figure*`.
- `build-lookout-architecture.py`: shared geometry model; requires Python 3 and
  ReportLab. Regenerates all formats without network or account access.

Use `\includegraphics[width=\textwidth]{lookout-architecture.pdf}`. Colored inner
bands identify logical capabilities, not separate services. Shapes, labels, icons
and connectors are editable native objects; no remote image assets are required.

## Arrow evidence

Implementation sources were inspected at local commit `6c44441`. The presentation
was subsequently revised without changing application behavior. Edge IDs are
retained in the editable source. Solid lines show calls/results or execution;
dashed lines show queued work and polling/wake coordination, not server push.

| ID | Connection | Repository evidence |
| --- | --- | --- |
| A1 | Human <-> Web UI | `next-app/components/draft-review.tsx`, `DraftReview()`; `backend/client.mjs`, `createBackend()`: authenticated human review and saved results. |
| A2 | Human -> personal agent: delegation | Conversation is external to this repository. `supabase/functions/agent-gateway/instructions.json` defines the connected agent contract; it does not implement the agent or its chat transport. |
| B1 | Personal agent <-> MCP tools | `supabase/functions/agent-mcp/protocol.mjs`, `createHandler()`: authenticated tool calls, schemas, scopes and results. `tool-surface.mjs`, `ACCESS_TOOLS`: progressive discovery and calls. |
| A3 | Web UI <-> backend | `lib/cloud.mjs`, `connectCloud()`; `backend/client.mjs`, `createBackend()`: account sync and authenticated domain RPCs. `20261013160000_job_board_backend_foundation.sql`, `approve_application()`: exact-revision human approval. |
| B2 | MCP tools <-> backend | `backend/runtime/service.ts`, `createDispatch()`; `lib/mcp-services.mjs`, `operationService()`; `supabase/functions/agent-gateway/index.ts`: routing to Node/Edge domain logic and RPCs. Tool visibility does not grant approval. |
| D1 | Backend <-> Supabase | `20261020170155_search_context_sweeps.sql`: search documents/progress/checkpoints. `20261027003600_durable_action_inbox.sql`, `private.sync_application_inbox()`: durable handoffs and history. `client-storage.mjs`, `clientStorage()`; `resume-upload.mjs`, `resumeUploadDispatch()`: private files. |
| E1 | Backend -> workers/browser: queue | `backend-jobs.mjs`, `BACKEND_TOOLS`; `20261026171906_backend_execution_queue.sql`, `backend_worker()`; `backend/runtime/worker.ts`, `workOnce()`; `application-worker.ts`, `createApplicationExecutor()`: leased jobs and guarded execution. |
| F1 | Workers/browser <-> employer sites | `backend/runtime/ats.ts`, `fetchSource()`: posting collection. `runner/ats.mjs`, `openApplicationForm()`; `runner/browser.mjs`, `inspectBrowserForm()` and `prefillApprovedForm()`; `runner/submit.mjs`, `submitApplication()` and `readConfirmation()`: supported form interaction and observed results. |
| G1 | Saved changes -> optional wake -> agent | `lib/muse-change-feed.mjs`, `MUSE_CHANGE_TYPES`: change pointers. `agent-package/watch.mjs`, `readPendingCount()`, `handleCount()`, `wakeCommand()` and `runWatch()`: count polling and a configured host command. `mcp/change-worker.mjs`, `consumeMuseChanges()`: record refresh, guide loading, verification and acknowledgement. After wake the agent uses B1/B2 again to retrieve current state. |

The shared-state strip denotes application-specific preferences, versioned domain
records and coordination rules; the actual durable storage is Supabase below.
The Action Board band denotes backend handoff records/transitions; its user-facing
view is rendered by the Web UI. The backend encompasses existing Node/Edge/domain
handlers, not five independent feature deployments.

## Important boundaries

- Private agent context stays with the external agent. Only selected task inputs
  or explicit preference writes reach Lookout; no complete memory synchronization
  is depicted.
- Supabase groups Postgres and private Storage. Workers/browser are executable
  code paths with configuration gates, not guaranteed always-running services.
- The dashed return path summarizes polling plus a host-provided wake integration.
  It is not direct database access, server push, or automatic execution on approval.
  A wake does not grant new authority. Resumption rereads current owned state.
- Routine automatic authorization and exact human approval are separate supported
  paths. The shield does not mean that every tool call needs manual approval.
- Submission is restricted to supported Greenhouse/Ashby/Lever forms. General
  employer automation, CAPTCHA handling and universal recovery are not claimed.

## Suggested caption

**Lookout architecture.** Humans and external personal agents use parallel web and
MCP interfaces to access shared career workflows. The backend persists preferences,
progress, approvals and evidence in Supabase and coordinates supported execution.
An optional polling/wake path lets the agent return and resume using current state.
Colored areas are logical capabilities rather than separate services.

## Verification limits

Native XML IDs, parent/edge references and text widths were checked. SVG embeds
editable XML, and the PDF contains vector/text objects rather than a page image.
Color and grayscale renders were inspected. No local diagrams.net application was
available, so editor import/round-trip remains unverified. After manual edits in
diagrams.net, export SVG/PDF there; the builder does not ingest those later edits.
