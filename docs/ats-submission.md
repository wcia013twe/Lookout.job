# Ashby and Lever submission

The local MCP runner and configured Node service now share guarded submission for canonical Greenhouse, Ashby and Lever postings (including jobs.eu.lever.co). AI Apply uses the same supported destinations through its owned durable queue. No separate profile, tracker, answer generator or browser agent is introduced.

## Source review

- [dyyfk/auto-apply](https://github.com/dyyfk/auto-apply/tree/31263bfee8fdff30d96512e96939d392db2d0003): reviewed scripts/lib/ashby.js and lever.js. Has real Playwright submission drivers, resume uploads, custom-question handling and a pre-submit hook. The Lever driver recommends human CAPTCHA completion. Its fallback choices, forced/repeated submit clicks and permissive success checks do not fit Lookout. No LICENSE file or license declaration was found in the reviewed tree/package; none of this code was copied.
- [torontodeveloper/job-application-agent](https://github.com/torontodeveloper/job-application-agent/tree/12c43544d724bf63b23ac9530c02145ecd64a388): reviewed main.py. Extracts native/custom controls, uses an LLM to map profile facts and essays, fills via Playwright and persists browser sessions. It explicitly leaves submission to the user. No LICENSE file was found in the reviewed tree; none of this code was copied.
- [muhammad-saadd/applyai](https://github.com/muhammad-saadd/applyai/tree/d4a97b5643aa219592883a43b068fc18dff94678): MIT. Ashby/Lever modules identify platform forms and extract native inputs, textareas and selects. File inputs are excluded; submission is manual. Adapted its platform form/label selectors into runner/vendor/application-controls.mjs. Exact reviewed modules and license are retained under runner/vendor/applyai/ as attribution/reference, not loaded as extension scripts. Their Git blob hashes are verified by tests.

No reviewed project is a drop-in universal submission service. Lookout reuses the licensed extraction pieces and extends its existing executor rather than importing another application's answer policy or database.

## Execution boundary

The runner opens the canonical posting and a unique same-job Apply link when needed (Ashby /application; Lever /apply). It waits for a visible form. Supported forms must contain exactly one native form; Ashby/Lever must also match a recognized platform form selector. Unassociated Lever field/card labels and Ashby data-testid labels supplement native accessible labels. Exact question text and option values remain pinned in the draft fingerprint.

Native text/email/tel/url/textarea, select, checkbox, grouped radio and one PDF resume upload use the existing reviewed bindings. Lever upload parsing must acknowledge the filename and finish before final validation. Required values, exact file bytes, DOM validity, revision, profile policy and single-use permit are rechecked before one submit click. Custom widgets, CAPTCHA, embedded/multiple forms, extra documents, unknown questions and changed conditional fields hand off without guessing.

Platform-specific markers, expected same-job confirmation paths and explicit success messages are checked in the runner, Edge payload contract and SQL persistence. A disappearing form alone never proves success. Receipts retain platform-specific runner-observed source labels. Existing Greenhouse receipts remain readable. A timeout after submission starts remains uncertain; retries report outcomes only and cannot authorize another click.

## Validation and release

Controlled Chromium fixtures intercept every employer request and exercise native Ashby/Lever forms through MCP, Node, Edge authorization and the complete migrated SQL database. They verify uploaded bytes, one POST, receipt persistence, AI Apply queue execution and duplicate prevention. They do not establish compatibility with every live tenant or prove successful real employer submissions.

Release the migration, Edge functions/config, Node service and frontend through the normal production workflow. Restart a local stdio runner for updated tools. Hosted worker execution still requires LOOKOUT_EXECUTION_ENABLED=true and LOOKOUT_SUBMISSION_ENABLED=true. Workday, account creation and custom company-site computer use are outside this implementation.
