# Feature delivery

Use four rules for parallel sessions:

1. One writing task, one isolated checkout, one branch. Reuse it for follow-ups.
2. Keep the shared `main` checkout clean; edit and install dependencies in the task checkout.
3. One PR per task. Let the existing merge queue validate and integrate it.
4. Commit and push intentional progress before handoff. Remove the task checkout after merge only when no uncommitted work needs preserving.

These rules apply to documentation and catalog updates as well as code. Before
editing, check the current path, branch and `git status --short`. Preserve edits
you do not own. If sessions overlap, move the new task into its own checkout.
Agents should flag an observed workflow problem briefly and suggest the smallest
fix; routine isolated work needs no extra confirmation or tooling.

Start each task in a fresh checkout of published main:

```sh
npm run feature:start -- search-improvements
```

Work in the returned temporary directory. Install its locked dependencies once
with `npm ci` and `npm ci --prefix next-app`. Keep the shared cloud-synced checkout
and other chats' edits out of the feature. Reuse the same feature directory for
fixes; an existing destination is never overwritten.

Implement and review the feature, run relevant local checks, and commit only its
files. `npm test` already includes the database suite. Write the PR description
to a file, then publish and queue with one command:

```sh
npm run feature:publish -- --title "Improve search" --body-file /tmp/search-pr.md
npm run feature:status
```

Publishing refuses main and dirty checkouts. It pushes the feature branch,
creates or updates one non-draft PR, adds `merge-ready`, and immediately wakes the
queue. Retries reuse the existing PR. It does not commit unrelated files or need
an agent to sit waiting for CI. Agents must attach the returned PR URL in Codex.

At handoff, include the checkout path, branch, PR URL, checks run and any
uncommitted work. Keep unfinished checkouts for resuming the same task. A dirty
checkout is work to preserve or review, not permission to reset or delete it.

# Merge queue

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
