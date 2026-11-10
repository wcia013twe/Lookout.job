# MCP host authentication boundary preparation

- Added an offline-only PostgreSQL hook and immutable user/client-to-connection
  binding, plus maintained jose ES256 verification with fresh authority resolution.
  SQL is outside migrations, no runtime imports/routes or configuration activate it.
- Added 18 executable SQL/signature scenarios for initial/refresh tokens, owner and
  scope boundaries, expiry/revocation, immutable mapping, human/JWT rejection and
  SQL permissions. Catalog validation: 158 roles; diff checks pass.
- Documented official provider source: the hook supports custom claims on both
  flows but cannot validate requested resources throughout refresh; old production
  Auth also lacks demonstrated account-endpoint isolation. No human token may be
  handed to the host. Described a bounded oidc-provider alternative.
- No credential, client, grant, live configuration, private record query, push or
  deployment. Existing runtime and event feature are untouched. Local SQL fixtures
  and keys do not prove provider account/Storage/Realtime isolation or a dot wakeup.
- Validation receipt: focused boundary 18/18; runtime/intelligence/frontend
  typechecks and production static build passed. Aggregate ran 1,363 cases:
  1,354 passed, five skipped, four failed while frontend dependencies were still
  installing (React/render imports unavailable). After installation, all four
  affected files passed 25/25 tests. The initial failed aggregate log is retained;
  there is no clean full aggregate/CI receipt for this unpublished branch.
