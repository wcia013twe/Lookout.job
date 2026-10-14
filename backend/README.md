# Backend / Muse handoff

Supabase project **job-board**, ref `umhqfqzpwmszhcknwtrs`, organization `personal-projects`, US East. The shared catalog contains 75 employer records. GitHub Pages remains the static frontend.

## Data and ownership

| Records | Purpose | Access |
| --- | --- | --- |
| Auth users | Google identity and sessions | Supabase Auth |
| profiles / preferences | Verified facts, search criteria, rankings and theme preference | Owner |
| resumes / private bucket | Immutable PDF/DOCX versions, references and SHA-256 | Owner; scoped agent temporary file links |
| answer_library | Reviewed reusable answers and autofill controls | Owner |
| jobs | Canonical employer facts | Shared read; trusted gateway publication |
| job_batches / batch_items | Morning inbox, order and private fit reasoning | Owner |
| applications / approvals | Current version, blocker, exact human approval and optional receipt | Owner; checked RPC transitions |
| activity_events | Durable user/agent/system timeline | Owner; canonical events produced by triggers |
| leaderboard_entries | Opt-in alias and derived XP/streak/counts | Safe opted-in projection; owner preferences via RPC |
| private.agent_connections | Hashes, scoped expiry and revocation | Server only |

RLS is enabled on exposed tables. Public clients use only the publishable key. Agent management derives the user from a verified Supabase session; tool operations derive ownership from the credential hash. A caller-supplied user ID is never authoritative.

## Schema and deployment

**`supabase/migrations/` is the only schema source.** Versions match hosted migration history. Do not reapply the initial schema to the live project or keep a second schema dump. `backend/check-schema.mjs` applies the migration chain to disposable PostgreSQL with Auth/Storage test doubles; hosted checks cover real permissions as well.

The two Edge Functions are deployed with platform `verify_jwt=false` because they implement custom authentication: human sessions are verified with `getUser`; opaque agent tokens are verified for hash, expiry, revocation and scope. Their server-only RPCs are not executable by anonymous or browser-authenticated roles. Never expose service-role credentials or add a general SQL tool.

- [Gateway HTTP contract](agent-contract.md)
- [Remote MCP setup](../mcp/README.md)
- [Application runner boundary](../runner/README.md)

## Frontend sync

`lib/cloud.mjs` serializes debounced updates and drains edits made during requests. Guest data stays local and is not silently imported after login. Offline edits persist in the account's browser namespace and retry when connectivity returns. Application updates use the expected server revision; stale drafts pause for review. Account switching clears in-flight ownership and never adopts another user's results.

Signed-in approval waits for sync and calls the database RPC. Human progress updates require a note and mark submissions **user-reported** unless an actual runner receipt exists. Submitted drafts cannot be rewritten. Opening a posting stays browser link history, not a submission.

Private morning links use `?batch=<uuid>`; authentication still controls access. Latest owned batches can load without an explicit locator. Missing/foreign batches fall back to public Discover without disabling the private workspace.

## Google configuration

Google is enabled. Keep its client secret in Supabase, not git or chat.

- Google OAuth client type: Web application.
- JavaScript origin: `https://wcia013twe.github.io`.
- Google callback: `https://umhqfqzpwmszhcknwtrs.supabase.co/auth/v1/callback`.
- Supabase Auth Site URL / allowed redirect: `https://wcia013twe.github.io/codex-automated-job-board/`.
- Allow batch-link redirects on that exact app path, for example `https://wcia013twe.github.io/codex-automated-job-board/?batch=*`.
- Use only OpenID, email and basic profile scopes. Google testing audiences need explicit test users.

The auth bundle uses pinned Supabase JS and PKCE. A complete real-user Google sign-in and iPhone round-trip still need verification.

## Operational limits

Backend/MCP tools do not themselves provide a browser, SMS delivery, inbox monitoring, a scheduler or automatic submission. Muse needs a compatible custom-header MCP client plus its own notification/browser runtime. Short-lived resume URLs must not be logged. Native/private browser file operations remain unverified on iPhone.

Before inviting a wider audience, add account export/deletion, orphan-file cleanup, operational monitoring/rate limits and abuse handling. Browser-only networking/link history and local pack rewards remain separate from account state/progress. Themes and animations must not change approval or tracking semantics.

## Agent context versions

Migration `20261013183736_agent_context_versions.sql` adds private per-owner
settings versions and scoped context reads. The private version table deliberately
has no client policy or write grants; its RLS/no-policy advisor message is
informational and reflects deny-by-default client access. Only setting-table
triggers advance counters; the service gateway can read them.

Developer instructions/message defaults are deployed JSON in
`supabase/functions/agent-gateway/instructions.json`. Increment its version and
redeploy the gateway for changes. The two-value check does not retrieve personal
settings. `mcp/context-cache.mjs` is the agent-runtime helper; no server-side agent
memory, messaging transport or scheduler is added by this feature.

## Guarded native Greenhouse submission

Migrations 20261013225545 and 20261013225637 add attempts and explicit read-only
client grants. The service-only submission context/transition RPCs authenticate
scoped agent keys and compare current context at claim/start. Automatic policy
authorization is distinct from a human approval row. One-use permits, partial
unique active-attempt indexing and in-flight draft freezing prevent second clicks.
Unknown results persist a blocker; human-only negative verification releases a
retry. Signed receipts are unavailable: stored confirmation is specifically
runner-observed employer evidence. The browser can read its own minimal attempt
metadata, not write receipts or transitions. See runner/README.md and the gateway
submission modules for the execution contract.
