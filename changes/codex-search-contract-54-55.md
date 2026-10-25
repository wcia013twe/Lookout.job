# Search observation and progress contract diagnostics (#54, #55)

The discovery tools advertised arbitrary listing/count objects and unrestricted
coverage. The gateway accepted malformed fixtures that SQL rejected with generic
`Invalid observed listing` / `Invalid source progress` messages. Valid existing
fixtures already succeeded; the reports contain no original failing payloads.

Publish the nested observation vocabulary, nullability, count bounds and coverage
enum; validate these at the shared gateway boundary with field/index diagnostics
that do not reflect unknown keys or values. Preserve SQL, auth, source ownership,
version checks and replay semantics. Developer version 60 refreshes discovery.
No production data, schema migration, credentials, deployment or live reports.

Validation: focused search contract/context/MCP tests passed (12). Full suite passed 578 tests; catalog validation passed (158 roles); module syntax
and whitespace checks passed. The first full run lacked frontend dependency links
and failed three tests; the complete rerun passed after reusing installed dependencies. Existing resettable search demo fixtures
remain covered by the context test; no new UI interaction was introduced.

The shared checkout is on a non-main branch, so feature:start refused without
changing it. Work uses an isolated clone of current origin/main and a codex branch,
with existing dependencies reused; no large installation or build was needed.
No local landing: the parent serializes integration and only a draft PR is authorized.
