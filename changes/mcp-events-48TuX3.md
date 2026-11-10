# MCP Events for the existing Node API

- Add authenticated event discovery/subscription/unsubscription for the existing private Muse change feed. Reuse existing workspace Realtime invalidations and Node API; add no polling worker, credentials, account grants or service.
- Persist subscriptions and a leased transactional delivery outbox privately. Require existing workspace/activity scopes, signed callback verification, connection-time public-IP pinning, Standard Webhooks signatures, TTL/revocation checks, key rotation and bounded retries. Receipt does not acknowledge work or authorize actions.
- Add protocol/database/security tests and a resettable fictional event preview. Increment developer contract version to 158.
- Validation: focused lifecycle tests, runtime and intelligence typechecks, and catalog validation passed. Full suite/build and exact-commit CI results recorded in the PR.
- Limits: no live ChatGPT subscription. Production's existing custom bearer authentication is incompatible with the documented plugin connection flow; an explicit authentication scope decision is needed. IPv6-only callbacks fail closed. Node release requires the existing GCP deployment environment; no existing watcher is retired without verified end-to-end wakeup.
