# Application runner boundary

This is a small deterministic inspector and approved-prefill library. It does not submit applications, launch a browser, bypass CAPTCHA, or claim generic Workday support. Public ATS submission APIs require employer credentials; applicant automation must use the actual employer form or manual handoff.

## Working commands

Node 22+, no new package dependencies:

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

## Adapted local tools — no decision model

Licensed browser primitives and ATS entry selectors have been extracted rather
than adding either upstream application's dependency tree. See [THIRD_PARTY.md](THIRD_PARTY.md)
for pinned revisions, modifications and MIT notices. No Jev SDK, AI provider or
inference calls are included. A successful native prefill uses zero model calls;
Muse may separately draft new written answers before approval.

`createApplicationTools({getPage, loadCurrentContext})` in `agent-tools.mjs`
provides three functions for Muse's **own local browser runtime**:

- `inspect_application({url})`: navigate to an allowlisted job, open one unambiguous
  form entry, and return full questions, exact choices and a form fingerprint.
- `select_resume({userId,job,resumes,preferences})`: propose an owned resume from
  explicit keyword rules or a default; overlapping rules/missing files return
  Needs selection. Selection never approves a resume or edits an approved draft.
- `prefill_application({applicationId})`: obtain current records through the
  trusted loader, validate approval/resume bytes/form, then fill the existing
  page. Return compact progress/blockers; never click Submit.

Example host integration (browser creation and authentication belong to your
agent runtime; do not supply agent-asserted approval records):

```js
import { createApplicationTools } from './runner/agent-tools.mjs';
const tools = createApplicationTools({
  getPage: async () => dedicatedEmployerPage,
  loadCurrentContext: async (id) => trustedBackend.loadApprovedContext(id),
});
const form = await tools.inspect_application({url: employerJobUrl});
// Prepare a draft with form metadata; get human review in the board.
const progress = await tools.prefill_application({applicationId});
```

`trustedBackend.loadApprovedContext` is a host-provided capability, not an
implemented function exported by this repository. It must return current gateway
approval/application rows plus the owned resume, canonical job and pinned file
bytes. The remote job-board MCP does not launch browsers or expose these local
functions yet. Live employer testing, client registration and an atomic
submission/receipt adapter remain outstanding.

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
