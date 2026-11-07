# Workspace realtime subscription lifecycle

- Give each workspace subscription a UUID-suffixed topic. The pinned Realtime client caches channels by topic, so same-owner remounts or overlapping consumers previously tried to add callbacks to an already subscribed channel before asynchronous removal completed.
- Preserve owner-filtered invalidation, reconnect reconciliation and immediate callback suppression during cleanup. No database, writer, or MCP contract changes.
- Add regression coverage for pending removal, late callbacks, replacement delivery and concurrent same-owner consumers. Update the focused workspace-sync OpenWiki page.
- Demo coverage: detached-demo and cloud suspension checks pass; the fictional demo remains free of account subscriptions, so no fixture interaction change is needed.
- Validation: 39 focused subscription/cloud/demo checks passed; data validation (158 roles), frontend typecheck, production static export and git diff check passed. Full npm test completed with 1009 passing, 5 skipped and 15 environment-related failures (localhost listen EPERM and incomplete frontend installation). After dependencies completed, reran all 14 affected files with localhost permission: 79 passed, zero failed.
- Limits: no authenticated browser or hosted Realtime round trip performed; no push or production deployment.
