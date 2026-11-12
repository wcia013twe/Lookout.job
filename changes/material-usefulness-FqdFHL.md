# material-usefulness

- Add one-click Yes / Not really usefulness feedback to saved prep materials, reusing Action Board check/cross icons and button styles, with an optional note and no repeated prompt after answering.
- Store private feedback against the exact material version without changing content or awarding practice progress. Website and scoped MCP writes share ownership, validation, retry and concurrency checks; agent-reported preferences are distinguished from direct user feedback.
- Include fictional, resettable demo feedback and desktop/mobile interaction coverage, plus agent guidance and OpenWiki documentation.
- Validation: full npm test after integrating local main passed (1375 passed, no skips); focused artifact tests passed (19), and final feedback/Action Board tests passed (9). Frontend typecheck, production static build, validate:data and recorded desktop/mobile feedback interactions passed; typecheck, build and recordings were repeated after shared-icon reuse.
- Limits: hosted migration/gateway deployment and live-account production behavior are not verified. This pass is local only.
