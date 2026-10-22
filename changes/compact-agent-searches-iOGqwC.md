# Compact agent search history

- Replace the oversized sweep form and explanation with Agent searches: compact profile/date/window/status rows, expandable coverage and discoveries, and a New search disclosure for request settings.
- Retain explicit queued-request feedback, loading/errors, refresh, evidence, pagination, and resume guidance. Existing scoped search.request, search.run.read, search.context and search.discoveries.read operations are unchanged; no backend contract changes.
- Update the fictional demo summary and add scripts/check-searches-ui.mjs covering disclosures, request feedback, desktop/mobile screenshots, overflow and page errors using intercepted cloud reads.
- Validation: all 434 npm tests passed; npm run validate:data passed (147 roles); frontend typecheck passed; Impeccable detector returned no findings; headless desktop/mobile demo interactions passed and screenshots inspected.
- Limits: npm ci succeeded at root, frontend npm ci hit ENOSPC. Incomplete task dependencies were removed; checks used the existing shared frontend dependency installation through a local ignored symlink. Production build and real-account backend requests were not exercised. No deployment or publication.
