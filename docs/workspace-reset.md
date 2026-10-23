# Workspace reset

Local implementation; not deployed or verified against a hosted account. No live account reset is part of developing or deploying this feature.

The Reset workspace link at the bottom of My Profile → Overview opens `/workspace-reset/`. A signed-in human requests a read-only preview, then types `RESET MY WORKSPACE`. The browser calls the `workspace-reset` Edge Function using its Supabase session. The handler verifies the user with `auth.getUser`; owner IDs, object paths and deletion targets never come from the request. Anonymous users and opaque agent credentials are rejected. The function deletes private files through `storage.from('resumes').remove`, never by deleting Storage metadata with SQL.

## Scope

The allowlist in `private.workspace_reset_tables()` covers private candidate records, applications and their evidence, searches, batches, preparation, documents, company workspaces, outreach, preferences and onboarding. Keep this list and its guard triggers current when adding personal tables. Reset preserves Auth identity, Circle content and memberships, public jobs/companies, and monotonic settings versions. Revoked connection references remain because shared Circle revisions can reference them; names/scopes are cleared and credentials are revoked. This is a personal workspace reset, not account deletion or erasure of shared community contributions.

## Failure and concurrency

A stable reset UUID identifies one reset. Preview includes the current personal version. Beginning a new reset rejects a stale version, revokes connections, and marks the account pending. Workspace writes serialize with reset transactions and are rejected while pending. Authenticated writes carrying a JWT issued before reset completion are also rejected. Storage uploads issued before reset cannot recreate their old registered/reserved paths: these paths remain in the private reset tombstone. File deletion runs in batches of 100. Failed or partial deletion leaves the reset pending; inspect and resume the same UUID. Database finalization refuses any remaining private file, then deletes and verifies all allowlisted records atomically. Replaying a completed UUID returns its receipt without deleting new onboarding work.

The browser pauses autosync, clears only the active account cache after completion, signs out locally and navigates to Profile. Other browser sessions check the reset state before hydration and autosync, discard stale dirty caches on a new completed reset epoch, and retain guest/other-account caches. This cannot remove files copied outside Lookout, unsend messages, withdraw applications, or stop external schedulers. Pause personal-agent automations before resetting. Existing in-flight employer interactions cannot be undone by data deletion.

## MCP boundary

`open_workspace_reset` → `workspace.reset_handoff`, scope `workspace:read`, returns the authenticated human screen. The gateway authorizes through the existing version-read scope check. It never records confirmation or executes reset. Browser mutation uses the dedicated human-only Edge Function; its service-only RPC is unavailable to `anon` and `authenticated`. Agents have no equivalent execution capability, by design.

## Demo and validation

Demo mode uses a disposable memory store and fictional counts, the same confirmation text, an empty personal state after reset, and the existing Reset demo data action to restore fixtures. No production client, file or account call is used. Tests cover endpoint authentication/ownership, partial failures, ordered Storage deletion, completed replay, browser account switching/cache isolation, MCP handoff, and database finalization against disposable PGlite.

## Release requirements

Apply `20261023061223_workspace_reset.sql` through the normal main-branch production release process, then deploy `workspace-reset`, `agent-gateway` (including developer contract version 47), and `agent-mcp`. The new function uses `verify_jwt=false` with server-side `getUser`, matching the gateway's explicit authentication boundary. Release schema before frontend because autosync now calls `workspace_reset_state`. No release was performed in this feature pass. Before advertising hosted parity, verify preview, partial failure/resumption, file removal, cache invalidation, and re-onboarding on a dedicated disposable test account; never use a real account as the test fixture.
