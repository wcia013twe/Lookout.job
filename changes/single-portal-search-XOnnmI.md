# Single portal search

Added `submit_portal_search`, a narrow operation that delegates to the existing backend queue. Its saved profile and exact enabled portal ID use the same browser/MCP/SQL validation. SQL creates only that portal attempt, omits web queries and prevents a worker from widening the queued scope. Existing staging, lease renewal, verification, screening, deduplication and final-shortlist writes remain. Manual start supports the same selector. No preferences are rewritten.

Muse guide21/developer135 explain sequential two-portal searches and top-two selection after analysis of the complete shortlist. Fictional backend demo fixtures and reset tests cover a focused run without real writes or network activity.

Validation: final full suite 1,092 passed, 5 skipped, no failures; 52 focused checks passed. Strict runtime TypeScript, 158-role data validation, generated guide consistency and diff whitespace checks passed. Docker image `lookout-node:single-portal` built; isolated packaged-tool read-back confirmed the distinct operation and required portal ID. Focused SQL/MCP/browser tests cover source isolation, replay and changed-key rejection, omitted/changed portal fences, ownership, disabled sources, built-in defaults, and no application creation.

Limits: source selection adds no new provider support. ByteDance collection exists, but full-JD verification is unsupported; TikTok has no configured automatic adapter. No actual TikTok/ByteDance search, top-two ranking, publication, application, push or GCP deployment was performed. A local search was active during implementation, so runtime refresh must not interrupt it.

Checkout: `/Volumes/External SSD/Lookout/tmp/lookout-features/single-portal-search-XOnnmI/repo`; branch `codex/single-portal-search-XOnnmI`.
