# Copy saved JDs during publication

- New URL publication copies the latest owned archived JD instead of agent-written `employer.description`. Missing captures stay empty; existing catalog descriptions and private analysis are preserved. Existing `publish_batch` is the sole affected MCP boundary; no new tool or UI action.
- Fictional SQL coverage exercises latest full text, ID/URL publication, separate fit analysis, foreign-owner exclusion, missing captures and replay. Existing detached demo already displays the missing-description state; no demo interaction changes are needed.
- Validation: focused migrated SQL regression, MCP/write contracts (15 tests), `npm run validate:data` (158 roles), and diff checks passed. `npm test` exercised the full suite: three render failures from incomplete frontend dependencies passed on targeted rerun (6 tests) after locked install completed. Initial sandbox run also hit localhost binding restrictions; unrestricted rerun resolved those. No production frontend build: no frontend code changed.
- Limits: publication-only protection does not verify extraction completeness, repair older descriptions or deploy the migration to hosted Supabase.
