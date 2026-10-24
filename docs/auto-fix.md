# Muse → GitHub → Codex → Muse

## What remains

- Existing hosted MCP: `report_bug(title, description)` and
  `get_bug_status(issueNumber)`, restricted to one configured Muse connection.
- GitHub Issues stores reports. Stable normalized titles and private hash receipts
  prevent duplicate publication, including concurrent requests and uncertain retries.
- A Codex cloud task follows [the worker prompt](auto-fix-worker.md).
- Existing CI, `merge-ready` queue and GitHub Pages handle frontend releases.
- One release-signal workflow posts the release result to the issue and mentions
  the owner. Muse checks status on its next run and retries once per new releaseId.

There is no separate intake workflow, backend deployment pipeline, model API key,
VM, dashboard or additional queue service. Backend fixes still use Lookout's
existing backend release process; Pages success never verifies a backend release.

## Only these settings

In **Supabase Edge Function secrets**:

| Setting | Value |
| --- | --- |
| `LOOKOUT_BUG_GITHUB_TOKEN` | One expiring fine-grained token restricted to `wcia013twe/Lookout.job`: Issues read/write; Actions, Pull requests and Contents read; Metadata read is implicit. |
| `LOOKOUT_BUG_CONNECTION_ID` | ID of the authorized existing Muse connection, not its credential. Retain `activity:write` on that connection. |

The token is the only new credential. Never paste it in chat, source or MCP
arguments. No new GitHub Actions secrets are needed. Codex must have working
GitHub issue/PR access through its own existing connection; Git clone access alone
is not proof of that access.

## Activation

1. Merge this scaffold through the existing review/CI process. Create `auto-fix`
   if absent. Keep the existing merge queue and Pages permissions enabled.
2. Set the two Supabase settings. Apply the bug-report receipt migration and
   release `agent-gateway` and `agent-mcp` through the existing backend process,
   preserving custom authentication. Refresh Muse's tool discovery/context.
3. Register a **cloud-hosted** Codex task using `auto-fix-worker.md`, if the account
   supports recurring cloud tasks. Prevent overlapping runs. This session has no
   scheduler-registration tool: automatic Codex startup is still unconfigured.
   Do not substitute a desktop automation or copy login files into Actions.

Saving secrets or publishing the cloud environment does not register that task.
There is no separately billed inference configured. Existing GitHub Actions usage
is subject to the account's normal quota/billing.

## Reporting and feedback

```json
{"title":"Synthetic: settings panel does not open","description":"Attempted: Opened fictional demo settings.\nHappened: The panel stayed closed.\nExpected: The panel should open."}
```

No diagnosis is needed. Use fictional steps only: never include names, candidate
records, answers, credentials, IDs, URLs, screenshots or production logs. Server
checks reject common sensitive patterns but cannot recognize every possible
personal fact in free text. Reuse a stable title; deduplication is not semantic.
If a timed-out report remains pending, retry the same title rather than bypassing
its reservation. Administrators must reconcile uncertain receipts before clearing.

The worker links its PR using `Refs #NUMBER` and
`<!-- lookout-auto-fix-issue:NUMBER -->`. After tests pass, frontend fixes get
`auto-fix` and `merge-ready`. The existing queue preserves CI and branch protections.
Backend fixes remain draft for the existing release process.

The release workflow records frontend deployment evidence and closes the issue
only after success. `get_bug_status` verifies the run, linked merged PR and commit
ancestry. Only `readyToRetry: true` with a new `releaseId` permits Muse to refresh
and retry. A merged PR, closed issue, failed deployment or backend change does not.
This is polling on Muse's next run, not a push mechanism that wakes Muse.

## Verification

Run `npm test` and `npm run validate:data`. Reporting and release tests use
fictional data, disposable PGlite and mocked GitHub; they create no live issues.
After activation, submit the fictional report twice through Muse and confirm one
issue. Verify actual cloud pickup. Synthetic validation PRs stay draft; do not
manufacture a defect or ship a dummy change to test release. For a genuine fix,
verify CI → merge → Pages → issue receipt → Muse status → one behavioral retry.
Live cloud pickup, release and notification delivery remain unverified.
