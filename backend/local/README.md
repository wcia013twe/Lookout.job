# Local Supabase

This is an independent local development database, not a recovered copy of the hosted account. No Supabase CLI login or hosted project link is needed. PostgreSQL 17, Auth, private Storage and the gateway/MCP run in Docker. The 54 files in `supabase/migrations/` remain the single schema source; startup replays them in order, including their final functions, grants and policies. Do not apply a squashed replacement to the hosted project.

## Start

Keep the checkout, npm cache and Docker disk image on the external SSD. Docker Desktop's disk image location is a separate setting: moving the checkout does not move Docker images or database volumes. Confirm its location and available space before first startup. The pinned CLI downloads the required images during startup.

```sh
npm ci
npm ci --prefix next-app
npm run supabase:start
npm run supabase:env
npm run supabase:functions
```

Run the function server in its own terminal. `supabase:env` writes ignored `next-app/.env.local` and `supabase/functions/.env.local`, refuses to overwrite existing files, and never writes a service-role key to the frontend. Then run `npm run dev` in another terminal, or rebuild a local static export. Frontend endpoint settings are read at build time. Hosted endpoint defaults remain unchanged when no override is supplied.

Local endpoints:

- API: http://127.0.0.1:54321
- Database: PostgreSQL on 127.0.0.1:54322
- Studio: http://127.0.0.1:54323
- Mail: http://127.0.0.1:54324
- Gateway: http://127.0.0.1:54321/functions/v1/agent-gateway
- MCP: http://127.0.0.1:54321/functions/v1/agent-mcp

`npm run supabase:status` displays local credentials; keep secret/service keys private. Local keys are different from hosted keys. Both Edge Functions verify credentials in their own handlers, so platform JWT verification is disabled for those two functions only. See [Edge setup](../local-edge-functions.md).

## Validate

```sh
npm test
npm run validate:data
npm run build
npm run validate:local-db
npm run validate:local-edge
```

The real-stack schema verifier checks migration history, tables/RLS, buckets and service-only RPC permissions without changing data. The Edge verifier creates two explicitly fictional accounts on a loopback-only endpoint, tests login, ownership, scoped gateway/MCP access and revocation, and removes the accounts afterward. The existing admin demo remains fictional, resettable and isolated from backend storage; local runtime verification uses disposable accounts rather than production identities. Neither verification applies to hosted deployment.

`npm run supabase:stop` stops this project's containers and retains its local state. Do not use `db reset` or `stop --no-backup` against work you need to keep. Do not link this local checkout to the failed hosted project just to start it.

## Recovery limits

A clean migration replay creates tables/functions/policies and declared buckets. It does not restore production users, account rows, resume bytes, company logo objects, active sessions or existing agent credentials. The website's Google-only sign-in also needs a separately configured local Google OAuth client/callback; the local Auth smoke test verifies password login without changing that UI or claiming Google login works. Do not use real candidate data as demonstration fixtures. Recover hosted data from a verified export/backup once accessible, and reconcile schema versions before importing. A successful local setup alone does not migrate the live site or make localhost reachable by remote agent clients.
