# Muse reports → Codex fixes

## Status

This is a scaffold, not a running unattended coding service. It adds a real
GitHub `issues` event workflow and a hosted MCP reporting tool. The issue workflow
acknowledges the issue and mentions the owner; it **does not launch Codex**.
No supported scheduling/session-creation tool was available in the implementation
session, so no recurring Codex automation was registered. A shell watcher inside
this cloud environment is not a reliable replacement: tasks can stop.

There is no API model usage, new inference provider, VM, dashboard, queue service,
or Sentry dependency. GitHub Actions usage remains subject to the account's
included minutes and billing controls. The owner now authorizes automatic merge
and release of validated fixes through the existing queue. That policy is
scaffolded here, but is not live until this branch and its configuration are released.

## Layout

1. Muse calls `report_bug(title, description)` on the existing Supabase `agent-mcp`.
2. The gateway revalidates the connection's expiry/revocation and `activity:write`
   scope. Only the exact connection ID explicitly configured by the owner can
   publish. Existing activity scopes alone do not grant reporting to other agents.
3. The gateway checks GitHub for an unresolved matching title, reserves a receipt
   in the existing database, and creates an issue with `auto-fix`. It accepts no
   repository, URL, owner, labels or raw diagnostics arguments from Muse.
4. `.github/workflows/auto-fix-intake.yml` handles `opened`, `labeled`, and
   `reopened` events. It only acknowledges open `auto-fix` issues authored by the
   repository owner, posting one comment that mentions `@wcia013twe`.
5. A **separately configured cloud Codex automation** periodically examines the
   same GitHub issues. Its prompt is [auto-fix-worker.md](auto-fix-worker.md).
   It opens a linked PR with `<!-- lookout-auto-fix-issue:NUMBER -->` in the body,
   comments with the diagnosis and PR link, and mentions the owner. After its
   tests pass it marks the PR ready and adds `auto-fix` and `merge-ready`.
6. The existing merge queue requires passing CI and GitHub protections, pins the
   tested head, merges, and dispatches release. There is no separate approval bot
   and no bypass of required reviews: additional live protections can still block.
7. The release workflow applies changed Supabase migrations/functions before
   publishing the frontend. It compares against the last successful complete
   release, so multiple queued merges cannot skip a pending backend change.
   A missing credential, stale deployment, or backend failure stops the release.
8. After release completes, `.github/workflows/auto-fix-release.yml` records a
   bot-authored receipt on each affected issue and mentions the owner. PR bodies
   use `Refs #NUMBER` rather than a closing keyword, so unresolved issues remain
   open for duplicate detection until release succeeds; only then does the signal
   workflow close them. It signals
   failures too. Already-released PRs do not get a new comment on every release.
9. Muse calls `get_bug_status(issueNumber)` on its next run. The gateway verifies
   the PR, deployment workflow, same-repository main run, source commit ancestry
   and outcome before returning `readyToRetry: true`. Issue closure alone does
   not grant retry permission. Muse refreshes and retries fictional reproduction
   steps once per new `releaseId`, then reports the observed result.

## Enable reporting and the GitHub trigger

These are production changes; prepare/review/merge this branch first. Do not
deploy its functions directly from a feature branch.

1. Create the `auto-fix` label in `wcia013twe/Lookout.job` (Issues → Labels).
   Enable GitHub Actions for the repository. The issue workflow becomes available
   when its file is on the default branch. Its token gets only contents read and
   issues write; it cannot push, create PRs, merge or deploy.
2. Create an expiring **fine-grained GitHub personal access token** owned by
   `wcia013twe`, restricted to this one repository, with **Issues: read/write**
   plus **Actions: read**, **Pull requests: read**, **Contents: read** and implicit
   Metadata read for release verification. No Contents write or model API key is
   needed for the reporting/status tools. An owner-authored issue is required by the intake workflow. Token
   expiry/rotation must be maintained; this scaffold has no OAuth refresh service.
3. In **Supabase Edge Function secrets**, set `LOOKOUT_BUG_GITHUB_TOKEN` securely.
   Never commit it, paste it into a chat, put it in an MCP argument, or expose it
   as a browser environment variable. This is a Supabase runtime secret, not a
   GitHub Actions secret or a cloud-onboarding variable.
4. Set `LOOKOUT_BUG_CONNECTION_ID` to the ID of the specific existing Muse
   connection you authorize for reporting. Obtain the ID through Lookout's
   existing connection management; do not use the agent credential itself.
   Keep `activity:write` enabled on that connection. Replacing/revoking that
   connection disables reporting until the configured ID is updated.
5. Apply `20261024000000_bug_report_dedup.sql` through the normal migration
   process, then deploy `agent-gateway` and `agent-mcp` through the normal backend
   release process. Preserve their current custom-auth/`verify_jwt=false` setup.
   Gateway instructions advance to developer version 54; existing agents must
   refresh discovery/context. No frontend build or production candidate access is
   required for the reporting tool itself.
6. In GitHub Actions repository secrets, configure `SUPABASE_ACCESS_TOKEN` and
   `SUPABASE_DB_PASSWORD` for the existing project `umhqfqzpwmszhcknwtrs`. Use a
   project-scoped token with Edge Function write/read and the database/pooling
   permissions required by `supabase db push --project-ref`; use the project's
   database password for the migration connection. Never put these secrets in
   Muse, the worker prompt, PRs or issue comments. The pinned Supabase CLI uses
   server-side function bundling; no Docker service or persistent machine is
   needed. `supabase/config.toml` preserves the functions' existing custom auth.
   Reconcile hosted migration history through the normal release process before
   first activation; do not repair history, replay initial migrations or disable
   TLS to force a release. If secrets are missing, backend changes fail closed.
7. Verify the Supabase runtime permits HTTPS to `api.github.com`. Keep TLS
   verification enabled. The coding environment separately needs its own
   supported GitHub API connection for reading issues and opening PRs. The Git
   checkout proxy alone does not establish those API permissions.

An issue created by a normal PAT request can fire GitHub issue events. Do not
replace it with an Actions `GITHUB_TOKEN` and assume downstream workflows will
trigger: GitHub suppresses many events created with that token.

## Activate automatic cloud pickup

In the subscription product that offers **cloud-hosted recurring Codex tasks**,
create one task scoped to this repository, paste `auto-fix-worker.md`, and select
a periodic trigger (for example every 15 minutes if supported). Allow only one
active run at a time. Authorize repository reads, branch pushes, draft PR creation
and issue comments. For automatic release the worker also needs to mark its PR
ready and apply the existing queue labels. Keep `MERGE_QUEUE_ENABLED` enabled;
additional required-review or deployment-environment approvals must be satisfied
or reported as blockers, never silently bypassed. Verify execution occurs while
the desktop is off. Do not use
a desktop-only automation or copy a ChatGPT login/session file into Actions.

**This availability is unverified.** A subscription does not by itself establish
that this scheduling feature exists. If the product cannot register the task,
the workflow stops at “issue created and owner notified.” A manual cloud session
can use the same prompt, but that is not automatic pickup.

Alternative account-level integrations require a separate decision:

- GitHub documents a [Codex partner agent](https://docs.github.com/en/copilot/concepts/agent-capabilities/about-agents/about-third-party-coding-agents),
  assignable to issues and able to open PRs. Enable it in
  [cloud-agent settings](https://github.com/settings/copilot/coding_agent).
  This uses Copilot entitlement, Actions minutes and GitHub AI credits; it does
  not establish entitlement from a ChatGPT subscription.
- GitHub's [native issue-triggered automations](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-automations)
  support an issue-created trigger and `label:auto-fix` filter for private/internal
  repositories with eligible Copilot plans. Codex selection must be checked in the
  account; do not equate a Copilot model choice with a Codex partner-agent session.
- The official [Codex GitHub Action](https://github.com/openai/codex-action)
  requires a provider API key. Do not enable it without explicit billing approval.

## Safe reporting and duplicate behavior

Muse should use fictional reproduction steps, not actual candidate details:

```json
{
  "title": "Synthetic: settings panel does not open",
  "description": "Attempted: Opened the fictional demo settings.\nHappened: The panel stayed closed.\nExpected: The panel should open."
}
```

No diagnosis is required. The server rejects common credentials, email/mentions,
URLs, long identifiers, phone-like numbers and private-document terms. It never
loads application records or attaches logs. These checks are **not a guarantee
against arbitrary personal information in free text**: Muse must exclude all
real names, candidate facts, application answers and private content before
calling. Do not paste traces or production responses into reports. Authorized
diagnostics stay in their existing private systems.

Deduplication is deterministic for the same normalized title (case, Unicode,
spacing and punctuation). Reuse a stable title for the same problem. It is not a
semantic classifier: differently worded reports of the same bug can still need
human consolidation. The server checks up to 1,000 open issues and fails closed
on truncation or GitHub access failure. Repeated unresolved reports return the
existing issue, including a matching manually filed issue without the label;
it does not silently modify that existing issue or start a worker. A previously
closed report permits a new report if the problem recurs.

Database receipts serialize concurrent requests for the same title. At most five
new current receipts per rolling day are allowed. Receipts contain only hashes,
issue numbers and claim metadata; they are not a worker queue and browser roles
cannot access them. A timeout after reservation keeps the receipt pending to
prevent duplicate publication. Retrying the same title first checks for an open
issue. If a pending receipt remains and no issue exists, an administrator must
reconcile it after confirming the original request cannot still complete; never
clear it automatically or retry under another title. Closing/reopening issues and
rewriting titles manually can require reconciliation. The tool's response always
has `agentStarted: false`: a GitHub receipt is not proof of a coding session.

## Validation and end-to-end acceptance

Run `node --test tests/bug-report.test.mjs`, `npm test`, and
`npm run validate:data`. The synthetic tests use disposable PGlite and mocked
GitHub responses; they exercise MCP routing, credential/scope gates, publication,
duplicate suppression, closed reports, ambiguous timeouts, receipt permissions,
report limits, failure sanitization and one-time notification comments. No real
GitHub issue, cloud session, PR, or notification is created by those tests.

After deployment **and cloud automation registration**, run the actual test:

1. From Muse's actual MCP connection, submit the fictional report above. Record
   its returned issue URL. Submit it again with the same title; verify `duplicate`
   is true and only one open issue exists.
2. Verify the `auto-fix` label and intake workflow run. Check GitHub notifications
   for the owner mention; email delivery depends on notification settings.
3. With the computer off, wait for the registered automation. Verify a cloud
   session starts and handles the issue once. Do not infer this from an issue
   comment or the intake workflow's success status.
4. In explicit synthetic-test mode, let the worker investigate with fictional
   data. If no defect exists, request a clearly identified draft validation PR
   documenting the exercise; do not invent an application defect. Verify the
   linked draft PR, issue diagnosis/comment, owner mention and GitHub notification.
5. The synthetic validation PR stays draft and must not receive `merge-ready`.
   Test automatic release using a genuine small fix with the required regression
   test: mark it ready and apply both labels. Verify CI, queue merge, backend step
   if changed, GitHub Pages success and the release receipt on the original issue.
6. From Muse, call `get_bug_status`. A successful release containing that PR must
   return `readyToRetry: true` with a stable `releaseId`. Failed/in-progress
   releases, an unrelated CI run, or issue closure alone must not authorize retry.
   Muse refreshes and retries once for that ID. Confirm its observed result.
7. Close the fictional exercise artifacts after recording the result. Do not
   manufacture or automatically ship an application defect merely to test this.

`tests/bug-release.test.mjs` also exercises release receipts, failed/stale/fork
runs, reopening, duplicate signals, authorization, and backend release planning.
Local tests passed during implementation; live publication, trigger execution,
cloud registration, automatic release and notification receipt remain unverified.
