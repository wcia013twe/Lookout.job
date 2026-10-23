# Keep workspace data hidden until sign-in

- Replace signed-out workspace pages with the existing Google sign-in control. Do not mount private surfaces, counts, cached guest identity or the dashboard tour while auth is pending or signed out; anonymous sessions also remain gated.
- Account role selection no longer falls back to the public catalog. Expose neither catalog nor batch roles before sign-in, start accounts without private batches empty, and clear the previous batch when account identity changes. Signed-in public catalog browsing remains an explicit choice.
- Preserve guest/account storage namespaces and explicit onboarding. Privacy and individual toolkit guides stay public. Explicit detached demo mode continues to use the existing fictional memory fixtures, with no auth requirement or production writes.
- Existing Google OAuth/sign-out and scoped authenticated MCP boundaries remain unchanged; this rendering fix adds no service or MCP capability. Public static catalog assets remain public.
- Validation: root/app npm ci; all 537 tests passed (including access transitions, account switching/storage, database, approvals and demo isolation); frontend typecheck; production static export (55 pages, 388 offline assets); catalog validation (158 roles); git diff --check.
- Browser verification: check-signed-out-ui.mjs passed on desktop and mobile with intercepted fictional APIs, populated guest cache, mutation monitoring for data flashes, all workspace routes, public privacy, explicit demo, empty signed-in account and immediate sign-out. Reviewed desktop/mobile screenshots on SSD. Existing demo fixtures remain representative; no new fictional records were needed.
- Limits: real Google login, real private-account round trips and hosted deployment are not established by these local checks. No external submission or account write was performed. Existing moderate root dependency advisory is outside this fix.

Final integration also retained concurrently landed onboarding sign-in and application-question fixes. The combined 537-test suite and production export passed after those merges.
