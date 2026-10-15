# openwiki-agent-tooling

- Added repository-local Codex/OpenWiki integration and a six-page, claim-backed OpenWiki covering setup, architecture, discovery/tracking, gateway/MCP behavior, submission safety, and delivery operations.
- Added OpenWiki retrieval guidance to `AGENTS.md` and the generated scheduled update workflow.
- Validation: `npm run validate:data` passed (76 roles); `git diff --check` passed; OpenWiki finished with a clean run state; and the final landed `npm test` run passed all 293 tests.
- Limits: the scheduled workflow was not executed and requires repository secrets; if published and enabled, it will make daily `gpt-5.6-terra` inference calls. User-level Python, Headroom, and Ponytail installation is outside this repository change. Ponytail hooks remain untrusted pending explicit approval.
