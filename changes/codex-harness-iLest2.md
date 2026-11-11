# codex-harness

Adds RTK's Codex `PreToolUse` hook to compact Bash output in this repository and links its command-output guidance from `AGENTS.md`.

- Validation: `rtk init --codex --dry-run` previewed the intended files; `rtk init --codex` generated them. `npm run validate:data` is the required catalog check.
- Limits: Codex must be restarted and the project hook approved before it runs. RTK telemetry preference could not be saved because the global config is outside the writable workspace; telemetry was declined. Knip and the unrelated OpenCode integrations were not changed.
