# Fix onboarding Simplify import crash

- Mount the scoped Simplify import controller when onboarding displays its import handoff; provide the required controller and reset the handoff across account/demo scope changes.
- Reuse the existing fictional demo CSV preview, save and reset interactions and scoped backend/MCP contract; no new actions or fixtures.
- Validation: all 531 npm tests passed, including fictional import/reset and scoped adapter/MCP tests; npm run validate:data passed (147 roles); production static build passed, including /onboarding.
- Limits: no interactive browser or live-account import performed.

## Secure connection instructions follow-up

- Clarify in onboarding, the shared demo steps and clipboard feedback that copied setup contains a secret token and belongs only in secure plugin/MCP settings or the agent’s secure connection form. The waiting screen now gives a credential-free chat request.
- Existing scoped connection issue/revoke and runtime-check boundaries remain unchanged; no service actions added.
- Verification: all 531 tests passed (including fictional demo connection/import and scoped contracts); data validation passed (158 roles); production build passed. Copy-only changes were reviewed in source; no interactive browser or live secure-form connection verified.

## Require sign-up or sign-in first

- Make authentication the first required step for real onboarding, including returning from later scenes after signing out. Remove the guest skip into Circle/workspace setup.
- Explain that Google creates a new account or signs in an existing one; preserve the existing OAuth return to onboarding. Remove the fictional demo option from the authentication step.
- Reuse the existing human-only OAuth boundary and scoped connection tools; no new backend or MCP actions. Onboarding always exits demo mode, including old demo links and blocked tab storage. Demo remains available elsewhere.
- Verification: all 532 tests passed, including onboarding OAuth return and the new demo-entry boundary regression; data validation passed (158 roles); production build passed. No live Google OAuth or interactive browser verification performed.

## Persist website onboarding and hide unfinished LinkedIn entry

- Save server-owned `data.websiteCompletedAt` when the signed-in user chooses Open my workspace; route unfinished accounts to setup and returning accounts to the dashboard. Wait for the server read, offer retry on failure, guard account switches and preserve privacy/reset access. No historical completion is inferred.
- Keep website completion separate from agent readiness, profile verification and submission authority. Existing read_onboarding_state exposes the marker; update_onboarding_step advertises the human-only website_complete boundary and SQL rejects agent calls. Revision and event replay checks are shared by the website and MCP paths. Gateway developer version is 50.
- Comment out the unfinished LinkedIn choice and remove its visible entry field. Résumé upload and later remain available.
- Demo: onboarding still has no demo route; other app demos stay intact. Existing fictional backend fixtures remain for isolation tests. Demo runtime skips account routing and never calls the completion save.
- Validation: all 535 npm tests passed, including new owner/revision/replay/human-only SQL coverage, MCP read parity and route/save unit tests; npm run validate:data passed (158 roles); production build passed. Security review confirmed private-table ownership checks, empty search_path, revoked direct function access and no client secrets/new public tables.
- Limits: no live OAuth or interactive-browser verification; no hosted migration, gateway deploy or production parity verification. Apply the timestamped migration and deploy gateway developer version 50 through the normal production workflow before advertising hosted support.

- Integration: preserved concurrent signed-out empty-board/access controls and dynamic application-question changes. Anonymous/guest sessions keep their sign-in screen, and public toolkit guides stay public; only authenticated real accounts run the completion check. All 540 tests passed after integration, including the concurrent access/application checks; data validation passed (158 roles). Production build rerun after integration.

## Production backend release — 2026-10-23

- Source: merged/published main `b85aafb`; GitHub frontend deployment 40016969736 already passed. Reinstalled the current lockfile after integration; all 540 tests and data validation (158 roles) passed.
- Applied the three missing committed migrations in order: workspace_reset (20261023061223), simplify_tracker_import (20261023160738), website_onboarding_completion (20261023195137). The managed migration tool generated execution timestamps; repaired only those three ledger versions to the canonical committed versions. Read-back comparison found all 52 local/hosted versions and names identical, with no missing or extra migrations.
- Deployed merged-main agent-gateway v26 (developerVersion 50), agent-mcp v22 and workspace-reset v1 through the authenticated production CLI. All are ACTIVE; explicit in-function authentication remains enabled with platform verify_jwt=false. No feature-only source was deployed. Existing GitHub deploy.yml remains frontend-only.
- Live HTTP checks with disposable accounts passed: fresh token issuance/credential read, human website completion, persistent read, identical-request replay, MCP read parity, human-only completion denial through MCP (403), cross-account isolation, developer contract 50, import list, reset preview and invalid-token rejection (401). Both temporary accounts were deleted; no real user's records or credentials were changed. A first verification-script pass misread the developer response envelope; corrected the test and reran the full pass successfully. Credentials stayed in process memory and were never printed or saved.
- Security advisor reviewed before/after. New private reset/import tables intentionally have RLS and no direct client policies; reset-state definer access remains authenticated and owner-scoped. Existing advisory categories remain; no broad auth/config changes made.
- Limits: no browser Google OAuth, real user import, external application submission or destructive reset was performed. No claim of unrelated feature parity. This release supersedes the earlier pending-backend limitation for onboarding completion.

## Remove credentials from copied chat handoff

- Replace bearer-token JSON setup copying with credential-free chat instructions in onboarding and settings. Copy token for secure entry is separate and explicitly returns only the raw token. Add revoke/start-over for the current onboarding token through the existing human-only connections.revoke boundary. No backend contract changes or credential deployment required.
- Share safe instructions first, then enter the token only in the agent’s actual secure form or plugin/MCP settings. Waiting/copy feedback and shared demo instructions follow the same distinction. No secure URL is fabricated.
- Verification: all 550 tests passed, including new credential-leak regression tests and existing fictional connection/revoke scenarios; data validation passed (158 roles); production build passed. No live user token was copied or revoked.

## Lightweight connection and automation registration

- Connection setup reads the saved automation list and requests registration in the agent runtime’s own automation settings, preserving timezone/times and deduplicating by Lookout task ID. Disabled/manual/unassigned routines stay unstarted. The setup report requires actual receipts or a concrete blocker, then stops. No jobs, imports, guides, task polling or immediate execution during setup.
- Add agent-only connection_test to the existing versioned/idempotent update_onboarding_step boundary. It records only a credential-backed check-in and returns the owner’s saved schedule and connection ID, without asserting browsing, advancing onboarding, granting approval or creating tasks. Browser checks are read-only with a bounded retry state. Existing real runtime attestation is separate.
- Gateway developerVersion 52; copied instructions, MCP initialization quickstart and browser copy follow the same bounded flow. Fictional connection check fixture covers the same no-task behavior, without account access.
- Validation: all 544 tests passed, including schedule owner isolation, revoked/human rejection, stale revision/replay handling, no-task/no-onboarding-advancement SQL checks, read-only browser polling and fictional fixture checks; data validation passed (158 roles). Production build passed. No actual Muse automation-setting write has been verified; the runtime must provide its own scheduler tools and confirmation.

### Lightweight setup production rollout

- PR #45 merged as b0b1751; protected CI and frontend deployment 40023282040 succeeded. Deployed merged-main gateway v27 (developerVersion 52) and MCP v23. Read-back confirmed the setup-first contract and advertised connection_test event. Public onboarding returned HTTP 200 and served setup-only/no-immediate-tasks instructions, bounded retry, and no automatic-discovery status message.
- Applied agent_connection_test through the managed migration tool. It assigned version 20261023210154. Automatic approval rejected changing production migration-history metadata; production history was left intact and the repository filename was renamed to the actual deployed version instead (SQL content unchanged). Local tests rerun after the rename: all 544 passed; data validation passed (158 roles).
- Automatic approval rejected the proposed disposable-production-account smoke test before execution, so no accounts, tokens or schedules were created by this verification attempt. Live verification is limited to read-only deployed-function/schema and public-asset checks. Local SQL tests cover authenticated owner isolation, revision/replay, revoked/human rejection and no task creation. Actual Muse scheduler registration is not verified or claimed.
