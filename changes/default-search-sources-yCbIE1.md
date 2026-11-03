# Shared default search sources

- Consolidated four existing aggregate sources, all 198 pinned Career Ops portal entries and all 43 named query templates into `lib/search/default-portals.json`. Preserved public routing/options, notes and enabled/disabled states; no upstream personal title/location filters are inherited.
- Accounts without saved portals inherit one shared built-in document in search context and leased run creation. Existing owned profiles and explicit saved source overrides remain intact. Browser/MCP/SQL document validation supports the full catalog and rejects executable or arbitrary provider config.
- Backend discovery uses the installed public provider registry instead of only Greenhouse/Lever. Ten-source bounded runs keep aggregate defaults first and rotate their remaining sample by durable run ID. Unscanned and unsupported sources remain explicit partial coverage; source reachability and full-description parsing are not implied.
- Demo context mirrors missing-document inheritance without executing searches. Edge document codec regenerated.
- Validation: all 888 tests passed; `npm run validate:data` validated 158 roles; production `npm run build` passed; focused SQL lease/default/catalog parity, versioned overrides and config rejection tests passed. Local API/worker image built.
- Limits: no real daily scan, employer submission or hosted deployment performed. Query templates are reference examples adapted to user targeting, not active personal criteria. Current supported verification/parsing and bounded-source coverage limits remain explicit.
