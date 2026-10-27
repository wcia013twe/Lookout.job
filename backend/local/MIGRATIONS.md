# Local SQL migration inventory

The local database replays `supabase/migrations/` in timestamp order. This is the
same authoritative migration chain used by the disposable database checks. It
contains the application tables, indexes, triggers, ownership policies, RPCs and
Storage bucket policies. Supabase itself supplies Auth, Storage, platform roles
and extensions; do not load the test harness's Auth/Storage substitutes into the
real local stack.

Keep the historical migration filenames and their SQL intact. These versions are
already recorded in the hosted project, and later files wrap or rename earlier
RPC implementations. Concatenating them into a second committed schema dump, or
replacing them with a squashed baseline, would create a second source of truth
and diverge hosted history. The local CLI configuration consolidates startup
around this existing chain instead.

From the initialized task checkout, validate the migrated local Docker database:

```sh
node backend/local/check-schema.mjs
```

The verifier reads the local project ID from `supabase/config.toml`, checks the
Supabase CLI container label and uses `docker exec` with a read-only PostgreSQL
transaction. It accepts no hosted URL or database credential. It compares applied
migration versions to the canonical filenames, derives the table inventory from
the migration SQL, checks row-level security on every application table, verifies
private resume/public logo bucket settings, and checks that gateway-only RPCs
cannot be executed by anonymous or browser-authenticated roles.

Run `npm test` for behavior scenarios, including owner isolation, stale revisions,
immutable approvals and agent/browser parity. The disposable tests use Auth and
Storage substitutes; the local verifier covers the real Supabase-managed schemas
and grants. Neither check alone proves an authenticated website/Edge Function
round trip.

Schema replay does not restore production account data, Auth identities, private
resume bytes, stored agent credentials, OAuth provider configuration or external
service secrets. Data recovery requires a separate usable backup/export. No
production connection or schema change is required for local initialization.
