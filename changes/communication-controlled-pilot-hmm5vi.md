# Matched-intent COM01/COM02 pilot harness

- Identical task requests and prescribed initiation accounting for both conditions.
- Forward native startup/default tool surface, preserving scoped isolation; remove eager schema discovery.
- Record MCP request latency and payload bytes separately for startup, discovery, task calls.
- Prospective COM1 v6/grade v5 and COM2 v5/grade v4; no historical edits.
- COM3/4 preliminary work preserved in checkpoint 9752e265, excluded from this landing.
- Dependencies installed; feature doctor and catalog validation (158 roles) passed. Focused Python/Node regression checks and new native-surface/telemetry contracts run; native preflight and inference reported separately. No full-suite or hosted-release claim.
- No product/UI changes; demo coverage is isolated fictional benchmark fixtures. No production data or external actions.
