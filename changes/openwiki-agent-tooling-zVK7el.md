# openwiki-agent-tooling

- Added repository-local Codex/OpenWiki integration and a six-page, claim-backed OpenWiki covering setup, architecture, discovery/tracking, gateway/MCP behavior, submission safety, and delivery operations.
- Added OpenWiki retrieval guidance to `AGENTS.md` and the generated scheduled update workflow.
- Validation: `npm run validate:data` passed (76 roles); `git diff --check` passed; OpenWiki finished with a clean run state. `npm test` passed 289/290 tests outside the sandbox; the remaining unchanged outreach-guide test fails only in the generated feature checkout because Git checked its Markdown fixture out as CRLF while the generated JSON contains LF. The same targeted test passes on local `main`.
- Limits: the scheduled workflow was not executed and requires repository secrets; if published and enabled, it will make daily `gpt-5.6-terra` inference calls. User-level Python, Headroom, and Ponytail installation is outside this repository change. Ponytail hooks remain untrusted pending explicit approval.
