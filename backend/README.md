# Job board backend — Muse handoff

Status: schema deployed to the `job-board` project (`umhqfqzpwmszhcknwtrs`) in `personal-projects`, US East. All 75 employer job records are seeded. Browser cloud sync is not connected yet. Existing local data is untouched. Do not claim an agent runner, SMS delivery, or automated submission is live.

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
