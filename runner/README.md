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

`browser.mjs` accepts an existing Playwright `Page` supplied by the user's permitted local runtime. `inspectBrowserForm(page)` extracts labelled native controls on official Greenhouse/Ashby pages. `prefillApprovedForm(page, context)` fills supported native fields and PDF uploads only after approval validation; it never clicks Submit. It re-inspects for conditional-field changes and reports a blocker. Custom dropdowns, radio groups, checkboxes, consent, CAPTCHA, embeds, multiple forms and dynamic unanswered controls stay manual. Browser execution has not been validated against a live employer form.

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
