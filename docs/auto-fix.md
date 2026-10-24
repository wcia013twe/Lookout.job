# Muse → GitHub → triple t → Muse

Muse's existing `report_bug` creates an `auto-fix` issue. A separately configured
cloud-hosted triple t schedule checks the queue and follows
[the worker contract](auto-fix-worker.md), investigates, tests and opens a linked
**draft** PR. This repository does not register or prove activation of a schedule.
The supported GitHub automation event is pull_request, not issues; no issue
webhook or authenticated direct dot endpoint is assumed. Do not create placeholder
PRs to manufacture a trigger. Scheduled pickup is not instant delivery.

## Existing reporting configuration

The existing backend uses `LOOKOUT_BUG_GITHUB_TOKEN` (owner's repository-scoped
GitHub token) and `LOOKOUT_BUG_CONNECTION_ID` (authorized Muse connection with
`activity:write`). No new credential, access grant or backend deployment is needed
for this handoff change. Never copy Codex login files into Actions. The removed
launcher no longer uses `CODEX_CLOUD_ENV_ID` or `CODEX_CLOUD_ACCESS_TOKEN`; this
change does not modify stored secrets or variables.

## Queue and activation contract

Configure a supported triple t cloud schedule separately, at most hourly, using
the worker contract and existing GitHub connection. Confirm read access before
activation. Serialize runs and preserve active issue/session ownership across
runs. A schedule must not start a second repair for an uncertain or active task.
Verify real pickup before describing the integration as live.

Only open, non-PR issues authored by `wcia013twe` with the exact `auto-fix` label
are authorized. Muse uses that owner's token; its identity is not a separate
GitHub login. Recheck these fields after search and before any work. The optional
`GH_TOKEN=... node scripts/auto-fix-queue.mjs` is a read-only metadata helper,
not a dispatcher, scheduler or lock. Use existing credentials without printing
them. It excludes other authors and returns queued, linked_pr, or
needs_reconciliation. Inspect old github-actions[bot] launch reservations before
starting work, even if the old CLI submission lacked a confirmed task URL.

Producer dedupe uses an NFKC-normalized, lowercased, punctuation-collapsed title,
SHA-256 fingerprint, private reservation ledger and
`<!-- lookout-bug:FINGERPRINT -->` issue marker. Issue creation still returns
`agentStarted: false`: publication never proves pickup. An existing same-title
issue may lack the required author/label; do not silently authorize or relabel it.
Consumer identity is repository plus issue number; PR identity is the exact
`<!-- lookout-auto-fix-issue:NUMBER -->` marker. Reuse open PRs and wait for
release of merged PRs. Closed unmerged PRs require diagnosis before retry.

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
`<!-- lookout-auto-fix-issue:NUMBER -->`. All fixes get `auto-fix` and remain draft for human review. The worker must not
add `merge-ready`, merge, or deploy. Existing release workflows run only after
separate human release authorization.

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
Queue tests use mocked GitHub reads and create no task or issue. Live scheduled
pickup, release and notification delivery remain unverified by repository tests.

## Reporting failure diagnosis

The report description is one string containing actual newlines: each of the
three lines begins at column one with `Attempted:`, `Happened:`, or `Expected:`
and nonempty fictional reproduction text. Bullets and Markdown headings do not
match the schema. JSON encodes these newlines as `\n`; do not double-escape them.

Version 58 reports a fixed failure stage and, for rejected GitHub HTTP requests,
the numeric status only. It never returns raw upstream errors or headers. A
precheck failure means that request did not attempt issue creation. Stop retries
until repaired; a label-check 404 can mean a missing label or inaccessible repo,
not proof of either. An issue-create or receipt-finish failure is uncertain:
check GitHub and receipt reservations before retrying the same title at most once.
Never clear reservations automatically. The existing ledger permits five report
reservations per day; this change does not raise that limit.

This diagnostic update requires the gateway and MCP release after review. It
does not repair or rotate credentials, create labels, or prove a live submission.
