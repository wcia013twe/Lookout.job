# Application runner boundary

This is a small deterministic inspector and approved-prefill library. It does not submit applications, bypass CAPTCHA, or claim generic Workday support. The local MCP adapter launches a dedicated browser. Public ATS submission APIs require employer credentials; applicant automation must use the actual employer form or manual handoff.

## Working commands

Node 22+; the offline inspection commands need no extra dependencies:

```sh
node scripts/runner-inspect.mjs https://job-boards.greenhouse.io/company/jobs/123
node scripts/runner-prepare.mjs trusted-context.json inspected-form.json resume.pdf
node --test tests/runner-adapter.test.mjs
```

Inspection performs one public Greenhouse GET with `questions=true`, preserves exact field/choice IDs, and lists consent, hidden, demographic and unsupported controls as blockers. Ashby public postings do not provide applicant forms; the command reports a browser handoff rather than using private employer APIs.

`browser.mjs` accepts an existing Playwright `Page` supplied by the user's permitted local runtime. `inspectBrowserForm(page)` extracts labelled native controls on official Greenhouse/Ashby pages. `prefillApprovedForm(page, context)` fills supported native fields and PDF uploads only after approval validation; it never clicks Submit. It re-inspects for conditional-field changes and reports a blocker. Native grouped radios and checkboxes are supported only with exact human-approved answers; checkbox values must be `true` or `false`, and required consent cannot be left false. Custom dropdowns, CAPTCHA, embeds, multiple forms and dynamic unanswered controls stay manual. Bindings are checked before any fill; the form is inspected again after every write. Browser execution has not been validated against a live employer form.

## Trusted contract

Fetch the current application/approval through the Muse gateway `approvals.read`, then load the owner-scoped resume row and associated job. Pass `{ application, approval, job, resume, resumeBytes }`; the context must come from trusted storage, not an agent-provided assertion. Offline JSON is useful for local fixtures, not an authorization boundary.

An application must be `Approved`, have no blocker, and match the immutable approval's owner, application ID, revision, entire draft, and entire resume record. The draft must include:

- `url`: exact canonical ATS job URL (no referral query/hash).
- `resumeId` and `resumeSha256`: approved resume identity and actual file SHA-256.
- `formFingerprint`: fingerprint returned by inspection.
- `questionsReviewed: true` and `questions: [{fieldId, question, answer}]`: exact employer labels/IDs and answers. Select answers use employer option values; file answers use the approved resume ID.

Existing manually approved drafts without these fields remain valid for manual application but cannot be automatically prefilled. Capture the metadata before human review; adding it afterward changes the draft and requires reapproval. One API/DOM pass is always labelled incomplete: the user must inspect the real form and conditional questions.

The result is `Prepared` or `Blocked`, always with `submission: manual-handoff`. It is not a submission receipt and must not set the application to Submitted. A future submit adapter needs a freshly checked current approval, an atomic submission claim to prevent duplicate attempts, and employer confirmation before recording a receipt. Credentials, arbitrary endpoint access, Workday, SMS and inbox handling are intentionally absent.

Sources: [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Ashby public postings API](https://developers.ashbyhq.com/docs/public-job-posting-api).

## Local MCP server — concrete runtime

The runnable stdio adapter owns a dedicated visible Chromium browser and fetches
trusted records directly. It forwards all hosted data tools and adds
`inspect_application({url})`, `fingerprint_resume({resumeId})`, and
`try_application({applicationId,attemptId})`. No model provider or custom loader
is needed. Existing library hooks remain available to custom hosts.

One-time setup on the machine running the agent (Node 22+, graphical session):

```sh
git clone https://github.com/wcia013twe/codex-automated-job-board.git
cd codex-automated-job-board
npm ci --prefix runner
npm run install:browser --prefix runner
```

Create a private agent connection in Profile with `workspace:read`,
`batches:write`, `drafts:write`, `activity:write`, `approvals:read`, and
`resumes:read`. Store the issued credential in the client's secret settings.
Register this **local stdio** MCP server; substitute an absolute checkout path:

```json
{
  "mcpServers": {
    "job-board-runner": {
      "command": "node",
      "args": ["/absolute/path/codex-automated-job-board/runner/mcp-server.mjs"],
      "env": { "JOB_BOARD_AGENT_TOKEN": "YOUR_PRIVATE_AGENT_CREDENTIAL" }
    }
  }
}
```

Do not commit a populated client configuration. Use this connection instead of
a duplicate hosted data connection. A remote-only Muse client cannot launch a
local stdio server; its host must support registering/running this adapter.
Reading developer instructions alone cannot install a browser or grant tools.
Muse client support and live employer execution remain unverified.

Workflow: check versions → inspect official job form → fingerprint the owned
uploaded PDF → prepare draft with exact fields/answers/hash/fingerprint → human
review → `try_application` with a stable attempt ID. The runner loads current
approval, public canonical job and private signed file, verifies all snapshots,
opens the form, and rechecks approval immediately before filling. It never
returns résumé bytes or signed URLs in its fingerprint result. Downloads allow
only this project's exact signed Storage object, no redirects or external résumé
references; upload those references to private Storage first.

Calls run serially because one process owns one browser. The browser stays open
for human completion until the client ends the process. No arbitrary browser,
shell or Submit tool is exposed. `Prepared` means prefilled, not submitted.
If prefill fails, this adapter reports Needs you directly: an embedded agent
recovery is **not connected**. Custom hosts may supply the existing bounded
recovery hook. Retain `pendingReport` when reporting is offline; retry only the
failure report. New answers/documents/forms require renewed approval.

Resume rules can live in the agent's local JSON configuration or the preserved
custom search-preference keys. No resume-rule editor is added to the UI:

```json
{
  "defaultResumeId": "owned-backend-resume-id",
  "resumeRules": [
    {"keywords": ["ML infrastructure", "inference"], "resumeId": "owned-ml-resume-id"},
    {"keywords": ["distributed systems"], "resumeId": "owned-systems-resume-id"}
  ]
}
```

Each rule matches **any** listed keyword in the job title/category. Different
matched resume IDs require a choice; there is no hidden ranking or model decision.
Rules remain candidate-specific data, separate from public employer records.

## Bounded recovery and Needs you

`runApplicationAttempt` in `attempt.mjs` and the optional `try_application` tool
perform Playwright prefill first. On a pre-submit failure they allow one
host-provided agent recovery, then rerun deterministic validation. The recovery
hook is not a bundled model and must be restricted to pre-submit operations.
When both fail (or no recovery exists), `runner.report_failure` persists a blocker
and next action in Needs you without replacing answers or resume selection.

Supply `reportFailure` in `createApplicationTools`; it should call the gateway's
`runner.report_failure` operation with the supplied payload. Supply an
`agentRecovery` hook only when your runtime supports constrained browser
recovery. The host still supplies the actual browser and current-context loader.
Use a stable attempt ID for reporting retries. The backend rejects stale
revisions, foreign applications and changes to submitted/final applications.

Uncertain outcomes or any indication submission started skip recovery and
require checking the employer portal/confirmation email. A callback claiming
Submitted is never accepted as evidence by this prefill orchestrator. Native
submission remains unimplemented. Missing or failed backend reporting returns
`reported:false` and a pending payload; retain it privately and retry reporting,
not application execution. Text the user through the agent's own channel; this
code does not send notifications.
