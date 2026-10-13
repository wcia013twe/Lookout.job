# Job board backend — Muse handoff

Status: schema deployed to the `job-board` project (`umhqfqzpwmszhcknwtrs`) in `personal-projects`, US East. All 75 employer job records are seeded. Signed-in profiles, preferences, saved answers, resume references, and application drafts now sync automatically. Existing local data is untouched. Do not claim an agent runner, SMS delivery, or automated submission is live.

## Deploy

1. Create a dedicated Supabase project in the organization confirmed by the owner. Confirm project cost before creating it.
2. Apply `schema.sql` once to that project using the Supabase migration tool. Record the migration in repository history using the CLI when available.
3. Seed `jobs` from `data/jobs.json`, projecting employer facts only. Keep `whyItFits`, rankings, and personal recommendations in `batch_items.recommendation`; never copy a personalized job object into the shared catalog.
4. Set Auth Site URL and redirect allowlist to the GitHub Pages app URL. Configure email delivery for real user signups.
5. Supply the frontend project URL and **publishable** key. Keep all secret/service-role keys outside GitHub Pages and git.
6. Instantiate a pinned `supabase-js` client and pass it into `createBackend` in `client.mjs`. Add sign-in and explicit one-time local import before enabling cloud state. Do not silently upload local personal records or overwrite local state on login.
7. Run the Supabase security/performance advisors and real two-account integration checks before enabling cloud sync.

## Data ownership

| Records | Purpose | Access |
| --- | --- | --- |
| Auth users | Identity and sessions | Supabase Auth |
| profiles | Verified factual answers; education/history/skills can be structured inside facts | Owner |
| preferences | Search criteria, independent tier lists, theme settings | Owner |
| resumes | Immutable file versions or references | Owner; private bucket paths `user-id/random-id.pdf` |
| answer_library | Reusable answers with provenance and verification | Owner |
| jobs | Canonical employer URLs and factual descriptions/location/compensation | Shared read; trusted server writes |
| job_batches / batch_items | Personal morning inbox, ordered job IDs and fit reasoning | Owner |
| applications | Current draft, revision, blocker, stage and receipt | Owner |
| approvals | Immutable draft/profile/resume snapshots | Owner read; checked approval RPC writes |
| activity_events | Append-only timeline with dedupe event keys | Owner; server writes agent/system events |
| leaderboard_entries | Opt-in alias, XP, streak and application count only | Signed-in read of opted-in rows; owner edits alias/opt-in |
| private.agent_connections | Scoped, expiring, revocable credential hashes | Server only |

## Approval and agent contract

Morning links should use `?batch=<uuid>`. A batch ID is a locator, never an access credential. Authentication plus RLS determines who can read it. The client adapter exposes `getBatch`; route rendering is not wired yet.

Agents should eventually receive individual random tokens through a server gateway, never the service-role key or a user password. Store only token hashes in `private.agent_connections`. Verify expiry/revocation and required scopes on every gateway request; derive the owner from the token, never trust a supplied user ID. Token issuance/gateway/MCP transport are not implemented yet.

Suggested gateway operations: publish_batch (idempotent event key), prepare_draft (expected revision), append_activity, get_application. Agents cannot approve drafts. Human approval calls the checked RPC. A runner must check an approval row matching the current revision and use its exact snapshot. Changing draft or blocker increments the revision. Approval never submits a form.

Application status and submission timestamps are tracking claims, not proof of submission. Treat only a validated runner receipt as confirmation. Leaderboard totals must be computed by a trusted server from accepted deduplicated events; browser users cannot update metric columns. No score computation is implemented yet.

Passwords, raw session cookies, agent plaintext tokens, and service keys do not belong in application JSON or logs. Files use temporary signed URLs, not public links. Define account deletion/export and stale file cleanup before inviting friends.

## Validation

`check-schema.mjs` runs schema and isolation/approval tests against disposable PostgreSQL via PGlite. It requires a pinned external PGlite installation supplied by `PGLITE_MODULE_PATH`. Auth and Storage schemas are minimal test doubles; hosted Auth, Storage, email delivery, advisors, and RLS must also be checked on the real project.

## Hosted verification — 2026-10-13

Both migration versions are recorded in `supabase/migrations/` using the exact hosted history versions. Hosted transaction tests passed for cross-owner isolation, approval creation, and edit-driven revision invalidation; all fixtures were rolled back. Security advisors report no findings. Performance advisors only report unused indexes, expected on a fresh project. The private resume bucket and all 11 public tables were verified. Use migrations for redeployment rather than applying the initial schema twice.

## Saved answer controls

The `saved_answer_controls` migration adds `autofill_policy` (ask by default) and `company_scope`; automatic reuse requires a non-null verification timestamp. `client.mjs` has save/delete methods but the browser controls use `workflow.savedAnswers` locally and sync those records for signed-in users. Match exact normalized question text and company scope only, fill empty draft answers only, and retain saved-answer ID/version provenance in the draft snapshot. Never treat reuse permission as permission to submit.

## Google sign-in activation

The app-side Google OAuth client is bundled locally from pinned `@supabase/supabase-js@2.117.3` using `npm run build:auth`. Only the publishable project key is shipped. PKCE callback handling and remembered sessions are enabled. Per-account browser state is isolated; the previous guest workspace remains intact. Signed-in workflow state syncs to the database; Muse access is not connected yet. Google was verified enabled in the project on 2026-10-13 after owner configuration. The deployed app includes the auth bundle; a complete user sign-in round trip remains unverified.

To activate:

1. In Google Auth Platform, create/configure a Web OAuth client using only openid, email, and profile scopes. Add the authorized JavaScript origin `https://wcia013twe.github.io`.
2. Add the authorized redirect URI `https://umhqfqzpwmszhcknwtrs.supabase.co/auth/v1/callback`.
3. Enter the Google Client ID and secret directly in Supabase Authentication → Sign In / Providers → Google, then enable it. Keep the secret out of git and chat.
4. Set Supabase Auth Site URL to `https://wcia013twe.github.io/codex-automated-job-board/`. Allow that same redirect URL, plus `https://wcia013twe.github.io/codex-automated-job-board/?batch=*` for morning batch links. Verify exact allowlist behavior with a real test batch.
5. If the Google app is in testing, add the intended users as test users. Test the complete sign-in/return/sign-out flow before claiming authentication is live.

Settings documentation: https://supabase.com/docs/guides/auth/social-login/auth-google

Public Discover remains usable without login. The existing local-only Profile/Application tools remain available while agent access is pending. Real cloud records continue to require Supabase authentication via RLS. Do not mistake local browser namespacing for encrypted or server-authenticated storage.

## Signed-in cloud sync

`cloud.mjs` connects the existing browser store to the owner-scoped backend. Saved form edits, company-tier moves, saved answers and application drafts sync after a 650 ms debounce; it does not upload unsaved form keystrokes. Guest data remains local and is never implicitly imported. Failed sync retains browser edits and retries on reconnection, with a Retry button for other failures. Unsynced edits persist across reloads; explicit Load account asks before replacing them. Application revisions are checked before updates; conflicts pause for review.

Morning links use `?batch=<uuid>` and load only batches owned by the signed-in user. Shared employer facts and personal recommendations are combined for display without mixing them in storage. Agents still need the pending gateway to publish batches.

Signed-in approval waits for sync and uses the database approval RPC; browser clients cannot set application approval/submission statuses directly. Private transitions were verified on the hosted database. Legacy opened-role tracker, networking, XP, and pack history remain browser-local. Resume file upload helpers exist but the current UI syncs references only. The timeline currently shows the cloud application state rather than a complete server event history.

Validation: 28 tests, including actual sync-controller behavior with offline/retry and owner isolation; hosted approval, stale-write and batch-access checks; security advisors clean. Full Google sign-in and mobile interaction remain unverified.
