# Affinda resume profile import

- Add a server-only Affinda stateless parser integration to the local Node API. Human and scoped MCP extraction share owned current-file lookup, byte/hash validation, bounded response mapping, sanitized failures and per-owner process-local caching. No browser OCR, generic URL fetch, profile mutation or automatic retries during parsing.
- Tutorial uploaded-resume selection, new library uploads and successful replacements offer the same explicit extraction and side-by-side review. Existing values/history default unchecked; only selected sections save. Protect unsaved background drafts, account identity and exact profile timestamps; adopt save receipts into serial autosync without stale whole-profile replacement. Imports remain unverified.
- Add Node-only parse_profile_resume, direct existing SQL routing for update_profile_fields, developer contract 58 and resume-parse guide version 2. Document local env setup and website/MCP boundaries. No migration or hosted deployment.
- Demo coverage: fictional extraction/review, conflict defaults, explicit history replacement, draft protection and memory-only reset; no file bytes, external parser calls or backend writes. Existing uploads/replacements open the same fictional flow.
- Validation: npm test (611 passing, including database scenarios); npm run validate:data (158 roles); backend and frontend TypeScript checks; production static build; mechanical UI detector (no findings); desktop/mobile browser interactions and screenshots; real local Dockerized Auth/Storage/SQL and Node MCP verification with disposable accounts/files (removed).
- Limits: Affinda responses were stubbed. No real key/document round trip, hosted deployment, Google OAuth, or vendor-accuracy benchmark was performed. A configured API key and frontend API origin are needed, followed by local API recreation/frontend restart. Cache is in-process for 15 minutes, not durable billing deduplication.
- Existing local Edge gateway boot fails because its earlier mounted checkout cannot resolve lib/search-screening.mjs. This feature's Node parsing and profile-field updates do not depend on it; unrelated gateway routes were not repaired or restarted. Existing containers were left untouched pending ownership confirmation.


## APILayer provider follow-up

- Replace the Affinda-only adapter with APILayer Resume Parser raw-byte upload (`apikey` header, fixed HTTPS endpoint); configure only server-side APILAYER_API_KEY. Existing tutorial/upload/replacement review and versioned human/MCP save boundaries are reused.
- Map the documented flat name/email/skills/experience/education response. Preserve free-text dates in descriptions; do not invent months, name parts, degrees or unsupported fields. Sanitize subscription/auth/quota/document errors and reject malformed/empty responses.
- Update vendor disclosures, API-key examples, agent contract/guide and local/demo fixtures. State APILayer's 15-second deletion claim accurately and leave scanned-resume OCR explicitly unverified.
- Validation: npm test (644 passing, including database scenarios); npm run validate:data (158 roles); backend/frontend TypeScript checks; production build; mechanical UI detector (no findings); desktop/mobile and signed-in tutorial browser checks; real local Dockerized Auth/Storage/SQL and human/MCP round trips with a stubbed APILayer response. Disposable accounts/files were removed. Developer contract 63 and resume-parse guide version 3 reflect the provider change.
- Limits: no real APILayer key/call, signup, subscription, or container restart; live parsing remains dependent on user configuration.


## Live local activation follow-up

- Move the user-supplied APILayer key out of the frontend env into the ignored mode-600 server env. Start a separate `lookout-resume-api` on loopback 8081 because the existing API checkout has active unrelated edits; preserve its API/worker and Supabase containers.
- Add an explicit live smoke tester using one generated fictional PDF and disposable local Auth/Storage records. Local PDF text validation catches malformed fixtures before transmission; cleanup runs on failures too.
- Fix the observed live date-array response and null names. Retain parser-returned dates as descriptions, warn about normalization/missing fields, and keep the misparsed phone out of profile facts. Add the credential-free fictional vendor response as a regression fixture. Update developer instructions and guide.
- Verification: live running-Docker API → local private Storage → APILayer → versioned profile save → scoped MCP cache reuse passed using a generated fictional PDF; temporary account/file removed. npm test: 645 passing; production build, backend type checks and data validation passed. The live fixture missed the name and misidentified employers, so connectivity is verified but extraction accuracy is limited. Main/task frontend env now points to loopback 8081; the active unrelated frontend was not restarted.
