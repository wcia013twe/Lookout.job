# Muse → GitHub → Codex → Muse

## What remains

- Existing hosted MCP: `report_bug(title, description)` and
  `get_bug_status(issueNumber)`, restricted to one configured Muse connection.
- GitHub Issues stores reports. Stable normalized titles and private hash receipts
  prevent duplicate publication, including concurrent requests and uncertain retries.
- The issue-triggered `auto-fix-launch.yml` uses the official experimental
  `codex cloud exec` CLI to submit [the worker prompt](auto-fix-worker.md).
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
arguments. The cloud launcher additionally needs its own Codex authentication (below). Codex must have working
GitHub issue/PR access through its own existing connection; Git clone access alone
is not proof of that access.

## Activation

1. Merge this scaffold through the existing review/CI process. Create `auto-fix`
   if absent. Keep the existing merge queue and Pages permissions enabled.
2. Set the two Supabase settings. Apply the bug-report receipt migration and
   release `agent-gateway` and `agent-mcp` through the existing backend process,
   preserving custom authentication. Refresh Muse's tool discovery/context.
3. Configure the cloud launcher below. Once the workflow is on main, owner-authored
   open `auto-fix` issues trigger it on creation, labelling and reopening. It
   rechecks author/state/label, serializes launches per issue and records a
   reservation before submission. Workflow retries do not launch duplicate tasks.

## Codex cloud launcher authentication

In **GitHub → Lookout.job → Settings → Secrets and variables → Actions** set:

- **Variable `CODEX_CLOUD_ENV_ID`**: your published Codex Cloud environment ID,
  with this repository and working GitHub issue/PR access. This is not this chat's
  `ccarenv_...` runtime instance ID. Use your Codex Cloud environment selection.
- **Secret `CODEX_CLOUD_ACCESS_TOKEN`**: a ChatGPT/Codex access token from your own
  authorized CLI login. Not an OpenAI API key or the Muse GitHub token.

For a one-time bootstrap from your own computer, authenticate Codex using its
supported device flow and file credential store (do not run these commands in
public/shared CI logs):

```sh
codex -c 'cli_auth_credentials_store="file"' login --device-auth
```

Using an authenticated GitHub CLI with permission to manage repository secrets,
transfer only the access token directly to the Actions secret without displaying
it or copying the refresh token:

```sh
python3 - <<'PYTOKEN'
import json, pathlib, subprocess
credentials = json.loads((pathlib.Path.home()/".codex"/"auth.json").read_text())
token = (credentials.get("tokens") or {}).get("access_token")
if not isinstance(token, str) or not token:
    raise SystemExit("No file-based ChatGPT access token found; finish Codex login first.")
subprocess.run(["gh", "secret", "set", "CODEX_CLOUD_ACCESS_TOKEN",
                "--repo", "wcia013twe/Lookout.job"], input=token, text=True, check=True)
PYTOKEN
```

Never paste the token or auth file in chat, an issue or the repository. The
workflow imports it through `codex login --with-access-token`, uses one attempt
with pinned CLI 0.163.0, and removes its temporary credential file. It does not
run the model locally or fall back to API billing.

**This is an experimental CLI wrapper, not a documented turnkey Actions OAuth
integration.** The command and access-token login exist, but live unattended
account access must still be verified. Access tokens expire; this scaffold does
not store refresh tokens or add a refresh service. When authentication fails,
refresh this secret from a valid CLI login and rerun the workflow. It is not a
maintenance-free permanent credential.

To validate, create an owner-authored fictional `auto-fix` issue and use Actions →
Launch Codex cloud fix → Run workflow with its issue number. Verify a real Codex
Cloud task link and session. If submission is uncertain, inspect Cloud tasks
before removing the reservation comment and rerunning. Never automatically clear
it. Missing/expired credentials post a sanitized blocker instead of claiming work
started. GitHub-hosted runner quota and normal subscription limits still apply.

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
The local launcher tests mock authentication/submission; they create no cloud
task. Live cloud pickup, release and notification delivery remain unverified.
