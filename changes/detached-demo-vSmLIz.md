# Detach the mock workspace from user accounts

- Split startup into lazy-loaded account and demo providers. Demo startup never imports the persistent account store, Supabase client or cloud sync; it exposes no real user, account identity or client handle.
- Removed the account-metadata gate. Anyone can use the existing Demo mode control or open a page with `?demo=1`. A tab-scoped session-storage flag retains mode only; fictional records remain in memory.
- Entry/exit use full navigation to tear down the previous runtime. Reset rebuilds fictional services and fixtures only; sign-in/out controls are absent in demo mode, and exiting does not sign out the actual account.
- Centralized demo assembly in `demo-runtime.mjs`, retaining profile, document, task, outreach and Circle fixtures. Existing account services/MCP authority remain unchanged; demo operations are local simulations, not anonymous account APIs.
- Added dependency-boundary checks proving the demo bundle excludes account startup/storage/backend dependencies, plus independent-instance, mutation/read-back, Circle read, reset, blocked-storage and navigation coverage. Updated obsolete admin-only documentation.
- Validation: all 473 tests passed; data validation passed for 147 roles; production static build passed on retry; `git diff --check` passed. The first build stopped on the repository's existing Next.js security advisory; no dependency upgrade is included.
- Limits: local implementation only, no deployment or publication and no live browser-session verification. Ordinary browser appearance preferences remain shared UI settings, not account records. When session storage is blocked, an explicit `?demo=1` URL selects the preview. Real schema/MCP rollout from the preceding feature remains pending.
