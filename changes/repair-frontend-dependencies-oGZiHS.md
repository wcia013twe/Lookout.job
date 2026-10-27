# repair-frontend-dependencies

- Reinstalled locked root and frontend dependencies in an isolated internal-storage checkout with user approval because the external SSD was unavailable. The prior frontend installation lacked the already-declared @nivo/sankey dependency and ran an older Next.js version.
- Restarted the frontend against the existing local Docker backend. No dependency declarations, application behavior, or demo fixtures changed.
- Validation: npm ci; npm ci --prefix next-app (audit reported zero vulnerabilities); frontend typecheck; @nivo/sankey module resolution; npm run validate:data (158 roles); Applications route HTTP 200.
- Limits: authenticated chart interaction was not exercised. The shared main checkout's installed dependencies remain stale; the running frontend uses this isolated checkout, which must be retained while in use.
