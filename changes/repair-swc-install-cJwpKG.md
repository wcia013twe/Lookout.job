# Repair Next.js SWC installation

- Complete the existing pinned Next.js 16.4.0 SWC lock entries for every supported platform, including the Apple Silicon registry URL and integrity hash. No dependency versions change.
- Validation: feature:doctor; root and frontend npm ci; clean frontend npm ci --include=optional --offline; native SWC binding load; frontend typecheck; static production build (50 pages); validate:data (76 roles); Turbopack development GET / returned HTTP 200 without SWC warnings.
- Limits: the shared checkout has pre-existing UI edits and an automatic Next lockfile patch. The user authorized replacing the generated lockfile patch and refreshing the shared local app dependencies. Unrelated UI edits are preserved. No UI, demo, service or MCP behavior changes; existing demo fixtures remain applicable.
