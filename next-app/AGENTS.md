# React and Next.js implementation

- Read `../product.md` for the product vision and `README.md` for current behavior, the scaffold and migration status. Preserve every feature, existing URLs, persisted data, and account boundaries during consolidation.
- Keep App Router pages and layouts focused on routing and composition. Colocate route-only components and hooks in that route's `_components/` and `_lib/`; keep genuinely shared UI in `components/` and shared browser adapters in `lib/`. Create folders only when they hold real code.
- Keep pages/layouts as Server Components when possible. Add `use client` at the smallest practical interactive boundary; hooks, browser APIs, and account interaction require client code. Keep providers as deep as their consumers allow without duplicating account state.
- Production is a static export. Server Components execute at build time here. Do not introduce request-time auth, Server Actions, cookie-dependent rendering, or dynamic API routes without an explicit hosting change. Private account data loads through the existing backend client.
- Prefer explicit ES module imports and typed contracts over `window.JB` globals, DOM-shaped adapters, and side-effect registration. Migrate the existing bridge incrementally; never delete a root module solely because it predates React.
- Keep transient UI state local. Calculate derived values during render and handle user-triggered writes in event handlers. Use Effects for external synchronization, with cleanup and protection against stale account responses.
- When adapting the external store, use `useSyncExternalStore` with stable subscriptions, immutable cached snapshots, and a hydration-safe server snapshot. The current `store.get()` clones its result, so it cannot be used directly as `getSnapshot` without adaptation.
- Preserve storage namespaces and authoritative backend ownership/revision rules. Keep demo state isolated. Context should expose account/services or focused slices rather than make every consumer subscribe to the complete workspace.
- Lazy-load expensive optional effects, including Three.js, at the interaction that needs them. Preserve reduced-motion behavior, offline support, and every feature; assess bundle and render costs in production before adding memoization or dependencies.
- Use TypeScript for new or migrated frontend modules. Preserve existing JavaScript domain modules until migrated safely. Avoid parallel `.jsx`/`.tsx` implementations of the same responsibility.
- Maintain one canonical file per responsibility. Compare and reconcile numbered copies before removing them; use Git for history. Do not create speculative service/repository layers, duplicate schemas, or another frontend.
- Verify refactors with affected behavior tests, frontend typechecking and a static production build. Include account switching, guest persistence, demo isolation and approval/submission invariants when touched.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
