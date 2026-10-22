---
type: operations
title: Testing, Data Validation, and Feature Delivery
description: The repository's validation layers and isolated feature workflow from a fresh checkout through local landing, with optional publication and production boundaries.
tags: [testing, delivery, git, validation, deployment]
sources:
  - id: openwiki-source-daf31e1da3487fbfbe26e703
    resource: repo://.github/INTEGRATION.md
  - id: openwiki-source-8037e2358a2c4f9b2c722a11
    resource: repo://AGENTS.md
  - id: openwiki-source-5b54a58d1b51cd490b0e7162
    resource: repo://package.json
  - id: openwiki-source-e427ac8f776114f15ac33a12
    resource: repo://scripts/feature-delivery.mjs
  - id: openwiki-source-1e0988be4eaa8a50e225c41d
    resource: repo://scripts/validate-data.mjs
generated: { by: "codex", at: "2026-10-15T07:09:51.577Z" }
verified:
  - by: openwiki/0.7.2
    at: 2026-10-22T07:08:18.987Z
---

# Testing, Data Validation, and Feature Delivery

Repository work is designed for concurrent local sessions without sharing writable state. Documentation, catalog maintenance, dependencies, and code all follow the same isolated feature workflow.

## Start in an isolated checkout

Keep the shared `main` checkout for inspection and local landing. Run `npm run feature:doctor` on a new host or after setup trouble, then start work from shared local `main`:

```sh
npm run feature:start -- <short-name>
```

The starter validates the name, clones committed local `main` into a unique temporary checkout, creates a `codex/…` branch, records the source checkout, and generates a task-specific change note. Install locked dependencies there with `npm ci` and `npm ci --prefix next-app`. Reuse that checkout for follow-ups and preserve unfamiliar edits rather than resetting or stashing them.

## Record and validate the change

Complete `changes/<unique-feature-branch>.md` with the outcome, checks actually run, and verification limits; remove its draft marker. Commit only files owned by the task.

Use the smallest relevant focused checks while iterating, then satisfy the repository contract before delivery:

```sh
npm test
npm run validate:data
```

`npm test` includes the database scenario suite. Catalog validation reads `data/jobs.json`, requires the canonical fields, restricts employment types and priorities, and rejects duplicate IDs or application URLs. Use `npm run test:db` only for focused database debugging. Schema changes belong solely in `supabase/migrations/`; do not maintain a duplicate schema dump.

Frontend changes should also run `npm run build`. Auth, cloud, or client changes require rebuilding the retained auth bundle. Agent/product actions need website/MCP parity tests against the same ownership, validation, and version boundaries. Demo fixtures and interactions must cover representative states without touching real accounts or external submissions.

## Land routine work locally

After checks pass, commit the feature and run this from its checkout:

```sh
npm run feature:land
```

Landing refuses `main`, a dirty feature checkout, or an unfinished generated note. It fetches current local `main`, merges it into the feature branch, then fast-forwards the shared local checkout. It does not push, create a pull request, or discard unrelated dirty files. Conflicts and overlapping local edits stop the operation for resolution in the feature checkout.

## Publish only when required

A pull request is optional. Use `feature:publish` only when the user requests GitHub review or production publication, or protected-branch CI is required. Publication integrates published `main`, pushes the feature branch, creates or updates one PR, labels it `merge-ready`, and wakes the queue. Production deployment occurs through the protected workflow after merge; feature branches must not deploy directly to the shared Supabase project.

At handoff report the checkout, branch, local-main commit, checks, push/publication status, and remaining uncommitted work. Remove an isolated checkout only after its work is landed or deliberately backed up.

See also [Quickstart](../quickstart.md) and [Gateway and MCP](../agents/gateway-and-mcp.md).
