# Career Toolkit artifact workspace

Career Toolkit opens on **Workspace**, with the existing manuals under **Tools &
skills**. A connected agent creates useful supporting materials while preparing
an authorized weekly plan. The website stores and renders that work; it does not
run generation or activate a scheduler. Existing authorized recurring agent runs
can use the workflow once the new tools are deployed and discovered.

The workspace presents saved materials as covers with category-specific colors
and type symbols. Weekly prep can occupy a featured cover; regular materials show
their title and concise metadata rather than full descriptions. The reader keeps
revision, archive and source controls under Material details, with discussion and
the material itself prominent. Both themes use the same content and controls.

## Text-first workflow

1. Read candidate/profile evidence, target roles, `read_preparation_planner`,
   `read_learning_goals` and `list_artifacts`. Use relevant tools/skills to plan.
2. Reuse or revise useful material; create company briefs, read-ups, explainers or
   practice only when they help. Research separates sources, hypotheses and gaps.
3. Save materials with `save_artifact`, linking existing interview or learning
   task IDs. Report only successfully saved artifacts as ready. A partially
   prepared week can explicitly show missing supporting material.
4. Return `url` / `versionUrl` in conversation. `path` / `versionPath` are relative
   website destinations. The URLs use the same production GitHub Pages base as
   existing application handoffs; changing hosting requires updating both.
5. Resolve “open Friday’s prep,” “make this visual” or “quiz me” through artifact
   tools. Discuss with my agent copies the exact ID/version and a read-first
   request. There is no verified automatic chat-context or inbound Muse handoff.

## Artifacts and rendering

`career_artifacts` stores the current owned revision. `career_artifact_revisions`
preserves immutable snapshots, including archive/restore revisions. Each artifact
has a title, purpose, category, Markdown/HTML format, full body, optional week and
company, dated HTTPS sources and owned task links. The body is bounded to 150,000
characters, also subject to the existing 256 KiB gateway request envelope.

Documents use Markdown with tables, code and safe HTTPS links; raw HTML and remote
images do not execute. Visual diagrams can use inline SVG in an HTML artifact.
Interactive HTML must be self-contained with inline scripts/styles/assets, with
no build step or per-artifact React component. It runs in an opaque-origin iframe
with only `allow-scripts`: no parent access, account storage, forms, popups,
downloads, workers or external resources. The wrapper CSP blocks resource loads;
the host CSP restricts frame navigation to the app origin so generated code cannot
navigate its frame to an external endpoint. Sources are opened explicitly from
trusted viewer chrome. Preview interactions are temporary and do not complete
practice. Restart activity reloads the same saved revision.

Search returns 25 metadata records per page, with optional category, week, owned
application/goal, archived and text filters. Readers can request any saved
revision; the viewer offers the latest 50 revisions. Archiving hides the artifact
from active results and planner links but preserves direct links and history.
New saves use a UUID and expectedVersion 0; updates require the current version.
An exact immediate retry replays; changed/stale payloads reject. No public sharing
or submission authority is created.

## Learning alongside interviews

`learning_goals` stores owned, versioned objectives and stable dated tasks. No
interview/application is needed. Read/save work through the same scoped action
service as artifacts. Saving preserves completed work, including removed completed
tasks, and preserves durations for tasks with recorded practice. Agents must not
reuse a task ID for different work.

The existing planner snapshot now includes learning goals and active artifact
references. The canonical planner allocates interviews first each day and learning
practice in remaining capacity. Both use the same daily budget and immutable
`preparation_sessions` ledger. A completion target contains exactly one
`applicationId` or `goalId`, plus taskId and expectedVersion. Mixed targets are
validated and credited atomically. Partial practice, retry, version and budget
rules remain shared; generating, opening or answering a quiz never records a
session. Past-due learning tasks remain visible for today, later goals wait until
they enter the seven-day window, and unscheduled work is disclosed.

## Website / MCP mapping

All website artifact and goal actions call `artifact_action(operation,payload)`.
The gateway dispatch derives ownership from a verified, scoped agent credential;
the browser wrapper derives ownership from `auth.uid()`. Both call the same
private validator/mutator. Direct table writes are denied to browser roles.

| Operation | MCP tool | Scope |
| --- | --- | --- |
| artifacts.list | list_artifacts | workspace:read |
| artifacts.read | read_artifact | workspace:read |
| artifacts.save | save_artifact | drafts:write + workspace:read |
| artifacts.archive | archive_artifact | drafts:write + workspace:read |
| learning.read | read_learning_goals | workspace:read |
| learning.save | save_learning_goal | drafts:write + workspace:read |

Existing planner read/budget/completion tools retain their names and add learning
and artifact references. Developer contract version 34 describes automatic
supporting-material preparation within authorized runs and honest failure handling.

## Demo, verification and release

Demo materials are fictional and memory-only: a prep pack, company brief,
interactive index-selectivity exercise and a learning task lacking material.
Archive/restore, revision viewing, discussion references and session completion
use disposable demo services. Account sync is suspended during demo, with late
responses invalidated; leaving demo resumes account hydration and retained edits.
Reset demo restores initial fixtures.

Run `npm test`, `npm run validate:data`, frontend typecheck/build and
`scripts/check-artifacts-ui.mjs` against a built export (see its LOOKOUT_* options).
Browser checks intercept account traffic and verify interactive behavior,
mobile/desktop layout, task links, exact-version references, archive/history,
parent/storage/network isolation and no demo account writes.

Deploy migration `20261022162519_career_prep_materials.sql`, gateway/config, MCP
and frontend together through the normal production release after integration.
Local checks establish implementation behavior, not hosted MCP parity, live
account verification, scheduler activation or generation by an external runtime.
