# Muse event watcher

- Agent package 0.2.0 polls existing event counts every 60 seconds and retries positive counts after a 60-second cooldown. HTTP/wake failures back off to about five minutes plus jitter by default. Explicit old config values require host updates.
- Versioned agent-package/change-resumption guides document event-triggered wakes, authenticated drain, acknowledgement after verified outcomes, idempotent handling and host serialization/pending-drain responsibility. Developer contract 140; no database redesign or new MCP writer.
- Repair optional change-worker reader validation so Action Board decisions reach read_action_board; AI Apply uses read_backend_jobs.
- Demo coverage: detached AI Apply/Action Board event counts wake without context counters, remain pending after wake and drain only on acknowledgement.
- Validation: npm test (1133 passed, five skipped), npm run validate:data, frontend typecheck, production static-export/package build and git diff --check.
- Limits: host watcher activation, actual Muse wake/browser work and employer submission remain unverified. Existing configure_agent_watch returns a legacy 120-second recommendation; host config explicitly overrides it to 60. No real event acknowledged or job claimed for testing.
