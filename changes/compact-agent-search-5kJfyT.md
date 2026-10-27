# Compact agent search summary

- Discover shows only the latest search date and status by default. Native keyboard-accessible Details disclosure retains search requests, refresh, run history, coverage and discoveries.
- Sort runs by their recorded creation date. Fictional demo includes an older completed run before the latest incomplete run to exercise selection and history.
- MCP mapping: existing search.run.read, search.discoveries.read and search.request remain unchanged; disclosure is local presentation with no backend write or new service action.
- Validation: npm run validate:data (158 roles), frontend typecheck, static production build, Impeccable detector (no findings), and scripts/check-compact-search-ui.mjs (desktop dark/mobile light, collapsed default, latest-run ordering, expanded evidence, overflow and page errors).
- Limits: browser checks use isolated fictional demo state with intercepted cloud traffic. No live agent search or production deployment was performed.
