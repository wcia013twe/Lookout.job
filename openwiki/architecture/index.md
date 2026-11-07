# Files

- [Data model, ownership, and consistency rules](data-and-ownership.md) - How Lookout separates shared catalog data from owner-scoped workspace records, and preserves consistency through RLS, canonical writers, versions, idempotency keys, snapshots, and leases.
- [System architecture and trust boundaries](system-overview.md) - Runtime topology for the Lookout job-search workspace, including the browser, Supabase, scoped agent interfaces, optional Node runtime, and local runner. Explains public catalog data, private candidate data, and which capabilities remain outside Lookout.
