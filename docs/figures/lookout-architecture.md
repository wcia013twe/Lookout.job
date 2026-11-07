# Lookout architecture figure

Source audit: local commit `6c44441`. This figure describes implemented logical
responsibilities and available execution paths, not verified deployment or measured
research benefits. Domain capabilities are grouped within one workspace; the boxes
are not a microservice deployment inventory.

## Deliverables

- `lookout-architecture.drawio`: uncompressed native diagrams.net XML; labels,
  containers, connectors and icon primitives remain editable.
- `lookout-architecture.svg`: vector drawing with the native XML embedded in its
  `content` attribute; no remote assets, raster images or HTML foreign objects.
- `lookout-architecture.pdf`: one landscape vector page, suitable for
  `\includegraphics[width=\textwidth]{lookout-architecture.pdf}` inside `figure*`.
- `build-lookout-architecture.py`: shared geometry source for all three formats.
  Run with Python 3 and ReportLab. The diagram is 1800 x 1000 drawing units.

Five low-saturation fills distinguish Human, Personal Agent, Lookout Interface,
Lookout Workspace and Infrastructure. Text labels and line styles carry the same
meaning in monochrome. Icons use local vector primitives, including a native
cylinder, rather than remotely loaded logos.

## Major arrows and implementation evidence

Edge IDs below are retained in the editable XML. Solid arrows represent
request/response or local execution. Dashed arrows represent asynchronous work
coordination, including polling: they do not assert a push transport.

| ID | Arrow | Implementation evidence |
| --- | --- | --- |
| A1 | User -> Web UI: review and edits | `backend/client.mjs`, `createBackend()` supplies authenticated review/write operations; `next-app/components/draft-review.tsx`, `DraftReview()` presents them. |
| A2 | User <-> external agent: delegation/conversation | External to this repository. `supabase/functions/agent-gateway/instructions.json` defines the connected agent's contract; `runner/mcp-server.mjs`, `serveStdio()` and `backend/runtime/api.ts`, `createApi()` implement its integration boundary. The diagram makes no claim that Lookout implements chat delivery or the agent. |
| A3 | Web UI -> workspace: goals, edits, approvals | `lib/cloud.mjs`, `connectCloud()` synchronizes account edits; `backend/client.mjs`, `createBackend()` invokes scoped domain RPCs. `supabase/migrations/20261013160000_job_board_backend_foundation.sql`, `approve_application()` persists authenticated exact-revision approval. |
| B1 | Agent <-> MCP: scoped calls/results | `supabase/functions/agent-mcp/protocol.mjs`, `createHandler()` authenticates, checks tool scopes and validates arguments. Agent-selected task inputs may enter calls; there is no automatic bulk export of private agent memory. |
| B2 | MCP <-> workspace capabilities | `backend/runtime/service.ts`, `createDispatch()` and `lib/mcp-services.mjs`, `operationService()` route operations to domain handlers/RPCs. `supabase/functions/agent-mcp/tool-surface.mjs`, `ACCESS_TOOLS`, exposes `discover_tools` and `call_discovered_tool`; this is tool access, not execution authority. |
| D0 | Logical capabilities -> domain services | Composition, not an independently deployed message channel. `supabase/functions/agent-gateway/index.ts` dispatches domain operations; `lib/mcp-services.mjs`, `MCP_SERVICES`, maps ownership and execution locations. |
| D1 | Workspace <-> Postgres | Versioned owned records and RPC transitions. `supabase/migrations/20261020170155_search_context_sweeps.sql` stores search progress/checkpoints; `20261027003600_durable_action_inbox.sql`, `private.sync_application_inbox()`, derives and resolves handoffs; `20261107002624_agent_audit_logs.sql` stores audit observations. |
| D2 | Workspace <-> private Storage | `supabase/functions/agent-gateway/client-storage.mjs`, `clientStorage()` and `resume-upload.mjs`, `resumeUploadDispatch()`, implement guarded file access/upload. Records retain private file references; URLs are short-lived. |
| E1 | Workspace -> workers: queue/claim | `supabase/functions/agent-gateway/backend-jobs.mjs`, `BACKEND_TOOLS`; `supabase/migrations/20261026171906_backend_execution_queue.sql`, `backend_worker()`; `backend/runtime/worker.ts`, `workOnce()`. Jobs are persisted, leased and fenced by version/token. |
| E2 | Worker -> browser: authorized execution | `backend/runtime/application-worker.ts`, `createApplicationExecutor()`; `runner/runtime.mjs`, `createLocalRuntime()`; `runner/submit.mjs`, `submitApplication()`. Execution is conditional on runtime flags and current server authorization. |
| F1 | Browser <-> employer sites: form interaction | `runner/ats.mjs`, `openApplicationForm()`; `runner/browser.mjs`, `inspectBrowserForm()` and `prefillApprovedForm()`; `runner/submit.mjs`, `submitApplication()` and `readConfirmation()`. Supported native Greenhouse/Ashby/Lever paths, not arbitrary website automation. |
| F2 | Workers <-> external posting sources | `backend/runtime/worker.ts`, `executeSearch()` calls `backend/runtime/ats.ts`, `fetchSource()`; source processing invokes copied Career Ops adapters. Posting retrieval can use APIs and does not always require a browser. |
| G1 | Persisted changes -> optional host watcher | `supabase/migrations/20261027003600_durable_action_inbox.sql`, `private.workspace_changed()`, records workspace invalidations; semantic change events are defined by `lib/muse-change-feed.mjs`, `MUSE_CHANGE_TYPES`. `agent-package/watch.mjs`, `readPendingCount()` and `runWatch()`, poll the gateway's count endpoint. An authenticated worker separately reads `read_muse_changes`; count polling does not reveal record contents. |
| G2 | Host -> agent: wake, then resume through B1/B2 | `agent-package/watch.mjs`, `handleCount()` and `wakeCommand()`, invoke a configured host command. `mcp/change-worker.mjs`, `consumeMuseChanges()`, refreshes referenced records, loads guides, and acknowledges only verified handling or a durable blocker. Actual model wake integration is host-supplied; an exit-zero command is not proof of resumed work. |

## Interpretation constraints

- The external personal agent owns reasoning, general personalization and native
  scheduling. Lookout owns domain records and explicit policy/transition checks.
- A human edit/approval becomes durable state; it does not itself start a worker
  or grant new task authority. A resumed agent must reread current records.
- Approval and automatic policy authorization are distinct. The shield represents
  current checks, not a requirement for manual approval on every action.
- The Agent host box is dashed because the Lookout watcher is optional. Its
  native schedules belong to the host. The former backend recurring scheduler
  was removed in `20261027023257_remove_backend_search_scheduler.sql`.
- Infrastructure includes external sites for visual economy; they are third-party
  systems, not owned Lookout services. Storage is private, unlike public postings.
- Audit events are observations/self-checks; no independent grader or automatic
  native trace collection is depicted.

## Suggested caption

**Lookout architecture.** An external personal agent accesses domain-specific
records and operations through an authenticated MCP interface. Humans review and
modify the same workflow through the web UI. The workspace persists progress,
approvals and execution evidence and coordinates supported worker/browser paths.
An optional polling watcher invokes a host wake command; the agent resumes by
retrieving current state rather than treating the wake as new authorization.
Domain capabilities are logical modules, not separate microservices.

## Verification and editing

The native XML was parsed and checked for unique IDs, valid parent/edge references
and text widths. SVG and PDF are generated from the same geometry; the PDF was
rendered for visual inspection. The PDF contains vector/text objects rather than
a flattened page image. The diagram does not require remote icon/font assets.

No local diagrams.net application was available, so an interactive editor
import/round-trip was not performed. After opening the `.drawio` in diagrams.net,
edit its native objects and use File -> Export as SVG/PDF. The Python builder
regenerates its own model; it does not ingest later edits to the `.drawio` file.
