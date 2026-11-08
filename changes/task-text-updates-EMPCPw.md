# Task text updates

- Updated Notifications v3 within the existing workflow-guide routing: useful prepared-application review handoffs and consolidated completion summaries, with minimal back-and-forth and no separate update store or schedule.
- Messages identify roles, material choices and held exceptions; distinguish found/prepared/confirmed submissions and explain independently continuing authorized work. Existing authenticated website approval remains required; text/batch/swipe approval is not advertised as implemented.
- Incremented developer contract to 122 and documented the source behavior in OpenWiki. No UI, service, schema or new MCP action was added.
- Validation: 27 focused workflow, MCP surface and briefing tests passed; validate:data passed (158 roles); git diff --check passed. Existing fictional admin demo guide-routing, scoped brief, stale-write and reset checks passed in that focused suite; no new UI interaction requires fixtures.
- Limits: source directions only; no live agent message, scheduler activation, text approval or hosted deployment verified. Full-suite result recorded below.
- Full npm test completed with failures: local HTTP integration tests cannot bind 127.0.0.1 in the sandbox; render tests also failed with incomplete frontend dependencies. The focused rerun of action-inbox integration and backend scheduler removal outside the sandbox passed all 3 tests. The full suite is not green. Root npm ci completed with an ENOSPC warning; frontend npm ci was interrupted after the disk-space warning. UI build/typecheck were not run for this instruction-only change.
- Landing reconciliation preserved the concurrent application-volume guidance; merged workflow/MCP/briefing checks were rerun.
- Final merged focused suite passed all 28 checks after updating the concurrent notification-version assertion; data validation passed.
