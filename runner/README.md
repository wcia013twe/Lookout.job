# Local application runner

The stdio MCP adapter forwards the board's scoped data tools and adds:

| Tool | Behavior |
| --- | --- |
| inspect_application | Open a canonical Greenhouse/Ashby job and inspect exact native fields/choices/fingerprint |
| fingerprint_resume | Hash an owned private uploaded résumé; return no bytes or signed URL |
| try_application | Human-approved prefill only; Prepared is not Submitted |
| submit_application | Server-authorized native Greenhouse prefill/validation, one claim, one click, observed confirmation |

No model dependency, arbitrary browser/evaluate/shell tool, CAPTCHA bypass or
embedded agent recovery is bundled. Ashby/Workday submission, extra documents,
custom widgets and unsupported confirmation pages remain manual. PDF only.

## Install or update

Node 22+, graphical session (Xvfb works) on the agent host:

```sh
git clone https://github.com/wcia013twe/codex-automated-job-board.git
cd codex-automated-job-board
npm ci --prefix runner
npm run install:browser --prefix runner
```

Existing checkouts: `git pull`, then `npm ci --prefix runner`. Restart the MCP process and refresh tool
discovery and read developer version 6. The browser starts lazily and stays open
until the process ends. Muse may launch the subprocess and speak newline MCP
if its host cannot register stdio formally. Its exact host support needs testing.

Create a connection in Profile with workspace:read, drafts:write, approvals:read,
resumes:read, plus batches:write/activity:write for discovery updates. Copy only
the raw token to private secret storage. Never commit populated configuration:

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

All hosted data tools are forwarded, so one connection suffices. Reading a prompt
does not install a browser or grant tools. Calls run serially on one dedicated page.

## Prepare once, execute under policy

Check context versions → inspect the **live browser form** → fingerprint the
private uploaded PDF → prepare a draft. Required metadata:

- url: exact canonical Greenhouse job URL; no query/hash.
- resumeId / resumeSha256: immutable private uploaded résumé and exact bytes hash.
- formFingerprint: browser inspection fingerprint, not the public API fingerprint.
- questions: exact `{fieldId,fieldType,question,answer}`; file answer uses résumé ID.
- Automatic answers: `profileField` for supported verified contact facts, or
  `savedAnswerId`/`savedAnswerVersion` for unique exact verified permitted answers.

Routine matches with auto-apply on need no per-application approval, but every
answer must trace to current verified facts/permitted library entries, and résumé
selection must match a configured default or unambiguous keyword rule. Select a
default PDF in Profile or set your résumé rules. Missing/ambiguous choices pause.
Important matches, unknown tiers and auto-apply-off require exact human approval
in the board. Human approval supports reviewed custom answers. Changed current
profile/resume/draft requires renewed authorization. No fake approval row is created.

Call `submit_application({applicationId,attemptId})` with a stable short attempt
ID. The tool loads current server authorization and private file, opens the job,
prefills native controls and validates all required fields, exact filled values,
file hash and fingerprint. It obtains an atomic claim and fresh one-use permit,
then clicks one unambiguous enabled native Submit control **once**.

Confirmation requires a supported marker absent before submission, visible after
it, a known success phrase, no remaining visible form, and the same canonical job
URL (or its /confirmation path). Supported markers: #confirmation,
#application_confirmation, [data-testid="application-confirmation"]. Unexpected
redirects, unsupported markers and timeouts remain uncertain, never assumed success.
Receipts are labelled runner-observed employer confirmation, not signed API proof.

## Duplicate prevention and recovery

One active/uncertain/confirmed attempt per owned application is enforced in SQL.
Claimed/started attempts freeze draft edits. Claims/start recheck the full current
context, credential/scopes, policy version and exact snapshot. A click permit is
returned once and expires within five seconds. An expired pre-click claim may be
cancelled; started/uncertain attempts **never automatically become retryable**.

After start, any exception reports uncertain and goes to Needs you. No agent
recovery or second Submit click is allowed. If reporting is offline, retain the
pendingReport privately and retry `report_submission_result` only. A fresh valid
credential for the same owner can deliver a result after credential rotation.

For uncertain outcomes, check the employer portal/email. If submitted, record
that in application progress as user-reported. If verified not submitted, use
**Verified not submitted — allow a new attempt** in the review dialog and enter
where you checked. Stalled started attempts must age five minutes. Human recovery
cancels the old attempt, clears the blocker and requires current authorization
for a fresh attempt ID. Agents cannot invoke this human recovery RPC.

## Verification and source boundaries

Fixture MCP/browser tests cover the actual orchestration, and PostgreSQL checks
cover ownership, scopes, revocation, claims, one-use permits, settings changes,
frozen drafts, confirmation, uncertainty and explicit recovery. No real employer
application was submitted during development. Live Muse/employer round-trip
still needs testing. Unsupported forms go to Needs you rather than raw clicking.

`agent-tools.mjs` and `attempt.mjs` retain optional custom-host prefill/recovery
hooks. Their scope stops before submission. `submit.mjs` owns the concrete guarded
execution path. Public offline inspection commands remain available:

```sh
node scripts/runner-inspect.mjs https://job-boards.greenhouse.io/company/jobs/123
node scripts/runner-prepare.mjs trusted-context.json inspected-form.json resume.pdf
```

Offline JSON fixtures are not authorization. Only gateway-loaded current records
are trusted. Downloads allow only this project's exact signed Storage object,
no redirects/external references. Upload reference résumés to private Storage first.
See [THIRD_PARTY.md](THIRD_PARTY.md) for extracted MIT primitives and pinned sources.

## Agent-owned profile setup

`upload_profile_resume({filePath,variant,eventKey})` accepts a user-provided local
PDF/DOCX (up to 10 MB), uploads exact bytes privately and returns its registered
resume ID. It needs `profile:write` and launches no browser. Identical owned
variant/checksum reuses the existing ID. The other hosted setup tools are
forwarded normally: read context, upload/reuse resume, read fresh context, then
save_profile_package to set the default and proposed facts/answers. No agent can
mark imported facts human-verified or enable proposed answers for automatic reuse.
Old connections can enable profile setup without replacing their token. Restart
this updated runner and refresh discovery to expose the local upload tool.
