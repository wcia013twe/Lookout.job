# Feature delivery

Use four rules for parallel sessions:

1. One writing task, one isolated checkout, one branch. Reuse it for follow-ups.
2. Keep edits and dependency installs in the task checkout; use shared `main` for inspection and local landing.
3. Land completed routine work in local `main`. Use a PR only when GitHub review, protected CI or production publication is explicitly needed.
4. Commit intentional progress before handoff. Remove the task checkout after landing only when no uncommitted work needs preserving.

These rules apply to documentation and catalog updates as well as code. Before
editing, check the current path, branch and `git status --short`. Preserve edits
you do not own. If sessions overlap, move the new task into its own checkout.
Agents should flag an observed workflow problem briefly and suggest the smallest
fix; routine isolated work needs no extra confirmation or tooling.

On a new host, or after any setup failure, run the read-only environment check:

```sh
npm run feature:doctor
```

It verifies Node.js, npm and Git and reports the checkout parent. GitHub CLI and
authentication are needed only for optional PR publication. This repository uses npm lockfiles; do not use pnpm as a fallback because
it can rewrite dependency metadata before the isolated checkout exists.

Start each task in a fresh checkout of committed local main:

```sh
npm run feature:start -- search-improvements
```

Work in the returned temporary directory. The starter records the shared local
main checkout and restores the repository's actual remote for optional publication. Install its locked dependencies once
with `npm ci` and `npm ci --prefix next-app`. Keep the shared cloud-synced checkout
and other chats' edits out of the feature. Reuse the same feature directory for
fixes; an existing destination is never overwritten.

Complete the generated `changes/<unique-feature-branch>.md` note with the
change, checks and verification limits; remove its draft marker. Keep one note
per task and update it for follow-ups. `CHANGELOG.md` remains the historical
archive, so parallel tasks no longer compete over its newest entry. Existing
branches without generated notes remain supported during migration.

Implement and review the feature, run relevant local checks, and commit only its
files. `npm test` already includes the database suite. Land the finished branch
into shared local main with one command:

```sh
npm run feature:land
```

Landing refuses main, dirty feature checkouts and unfinished generated change notes.
It fetches and merges current local main in the isolated task checkout, then
fast-forwards shared local main. It does not push, create a PR or discard unrelated
dirty files in the shared checkout. A conflict or overlapping local edit stops the
operation; preserve those edits, resolve in the feature checkout, rerun relevant
checks, commit and retry. Separate checkouts protect local ownership, but overlapping
edits to the same code can still require resolution.

At handoff, include the checkout path, branch, local-main commit, checks run,
whether anything was pushed or published, and any uncommitted work. Keep unfinished
checkouts for resuming the same task. A dirty checkout is work to preserve or review,
not permission to reset or delete it.

## Optional GitHub publication

When the user requests review, protected-branch CI or production publication,
write the PR description to a file and run:

```sh
npm run feature:publish -- --title "Improve search" --body-file /tmp/search-pr.md
npm run feature:status
```

Publishing fetches and merges current published main before pushing. It creates or
updates one non-draft PR, adds `merge-ready`, and wakes the queue. Retries reuse the
existing PR. A conflict stops before remote mutation; resolve it in the task checkout,
rerun relevant checks and commit before retrying. Attach the returned PR URL in Codex.

# Optional merge queue

GitHub processes labelled PRs in creation order. The worker refreshes an outdated
branch, explicitly starts CI for its new commit, and merges only the tested head
when main is unchanged and GitHub protections are satisfied. Approval-required
CI created by bot refreshes is approved only for the labelled same-repository PR
and its exact current head; fork workflow runs are never approved by the queue. Conflicts, failed
CI, unresolved reviews, or a failed completed production deployment hold the
queue; fix the oldest PR or remove its `merge-ready` label to release the next.
A running production deployment does not delay the next validated merge.

After merging, the worker explicitly dispatches deployment and another queue
pass. This avoids the five-minute scheduled fallback and the suppressed events
from `GITHUB_TOKEN` mutations. Deployments remain serialized. PR/CI/deployment
completion events also wake the queue; scheduling is only recovery.

The worker runs trusted main code, never PR code with write credentials. Main
still requires a PR, passing `CI`, current main ancestry, and resolved discussions,
including for admins. Fork changes need maintainer integration into a repository
branch. No force pushes or protection bypasses are used.

Set `MERGE_QUEUE_ENABLED=false` to pause; dispatch **Feature merge queue** to
reconcile. No Copilot subscription, PAT, or running Codex chat is required for
queue advancement. The publisher uses your existing `gh` authentication.
