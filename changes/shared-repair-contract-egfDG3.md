# Shared repair orchestration contract

- Developer context version 57 now publishes repairWorkflow globally: Muse reports eligible issues; scheduled triple t consumption investigates/tests and produces a linked draft fix PR; separate human authorization controls release; Muse retries a new verified frontend release only.
- MCP initialization, context tool discovery, and report_bug descriptions direct clients to the shared contract. Existing clients reload developer context and tool discovery on a developerVersion change; idle clients receive no push wake-up. Personal context and versions remain unchanged.
- Reporting and status permissions remain restricted to the configured owner connection with activity:write. Regression tests exercise shared discovery from other connections and prove that visibility grants no GitHub write access.
- No UI/demo behavior changed. Fictional MCP fixtures cover version refresh and denied reporting; no live issues, credentials, permissions, schedules or backend deployments were changed.
- Validation: 28 focused context/MCP/report/release tests passed; data validation passed (158 roles); production build and frontend typecheck passed; git diff --check passed. Final npm test passed all 570 tests. No lint script is defined; node --check passed for both changed JavaScript modules.
- Initial full-suite run overlapped frontend dependency installation and failed one guide-render test with a missing micromark module; rerun after installation completed. No source workaround or dependency changes were made.
- Release limit: requires separate review/merge and deployment of agent-gateway plus agent-mcp with instructions.json. Pages deployment alone does not publish developerVersion 57. Production/client pickup has not been claimed.
