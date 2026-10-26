# Local Edge Functions

The committed gateway and MCP entrypoints run unchanged in Supabase Edge Runtime.
Both functions require `verify_jwt = false` in the local `supabase/config.toml`:
the gateway validates human sessions with Auth `getUser` and opaque agent keys
through the database; MCP validates every request through the gateway. Disabling
platform JWT verification does not disable either function's authentication.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the local runtime.
Keep `SUPABASE_URL` as the internal Kong URL so gateway RPC and MCP forwarding
work inside Docker. Set this additional server-side environment value when
serving locally:

```dotenv
LOOKOUT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
```

Use the actual configured API port. This setting maps only returned signed
Storage upload/download URLs to the host-accessible API origin. Their original
object paths, signatures, expiry and ownership checks remain intact. It never
rewrites user-provided resume reference links. Omit it on hosted Supabase.
Private secrets and populated environment files belong outside version control.

Once Auth, database migrations, Storage and the functions are running, run:

```sh
node scripts/check-local-edge.mjs
```

The verifier reads local keys privately from `supabase status -o env`, or accepts
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. It refuses
non-loopback origins before any request. It creates two clearly fictional local
Auth accounts, tests actual human login, owned connection issuance/listing,
foreign-owner rejection, context reads, scope denial, MCP initialize/discovery/
context forwarding and revoked-token denial, then removes both accounts and
their private records even if a check fails. It logs no keys, signed URLs or
candidate data. It never submits an application or accesses the hosted database.

This verifies the local Edge/Auth/database path; it does not transfer hosted users,
private files or candidate records, configure Google OAuth, install an agent
scheduler, or establish a public MCP endpoint. The hosted database must recover
or an existing backup must be supplied before its data can be restored locally.
