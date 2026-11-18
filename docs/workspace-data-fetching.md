# Workspace data fetching

A warm workspace tab should render from data already in memory. An unchanged
route switch should make zero requests for a cached workspace projection.
Measure that separately from Next.js requests for route code and from refreshes
triggered by an actual data change.

## Where data lives

- Keep the core workspace snapshot in the account store. Load it once per
  account session and reconcile it using the existing workspace cursor. An
  unchanged cursor should produce an empty change set.
- Give each shared projection one cache owner at the nearest persistent layout.
  Include account identity and reset generation in the scope. Use route-local
  state for editor drafts, selections and controls. Clear private in-memory
  snapshots at sign-out, on account switch and after workspace reset.
- Load projections with persistent consumers, such as the Action Board
  navigation count, once per scope. Load secondary details on first use. Batch
  reads for a visible list and bound large collections with cursor pagination.
- When several screens need the same facts, reuse the same snapshot or derive
  them from the core workspace. Add a separate projection when a distinct
  bounded query is needed.

## When data changes

- Render the last successful snapshot during a background refresh. Refresh
  after a relevant successful write or an owner-matched sync signal. Coalesce
  invalidations received during an active request and read again if that request
  may predate a change.
- Let workspace sync handle reconnect and missed notifications. Route mounts
  and unrelated table changes should leave cached data alone.
- Keep user actions tied to the revision they reviewed. Validate ownership and
  revisions on the server. Surface refresh failures and give users an explicit
  retry for decisions that depend on a fresh snapshot.

## Action Board

The root workspace layout keeps one Action Board snapshot for navigation, the
board page and application decision controls. The existing board read and
workspace table signals supply the projection and its invalidations. Demo
writes refresh the same projection through the disposable store.

When adopting this pattern on another tab, use a production build in a browser.
Check first entry, several warm returns, matching and unrelated changes,
refresh failure, and account or demo reset. Count route assets separately from
data reads and measure time from the navigation click to usable data.
