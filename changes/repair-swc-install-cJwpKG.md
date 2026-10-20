# Repair Next.js SWC installation

- Complete the existing pinned Next.js 16.4.0 SWC lock entries for every supported platform, including the Apple Silicon registry URL and integrity hash. No dependency versions change.
- Validation: feature:doctor; root and frontend npm ci; clean frontend npm ci --include=optional --offline; native SWC binding load; frontend typecheck; static production build (50 pages); validate:data (76 roles).
- Limits: the shared checkout has pre-existing UI edits and an automatic Next lockfile patch. Dependency verification uses the isolated task checkout. No UI, demo, service or MCP behavior changes; existing demo fixtures remain applicable.
