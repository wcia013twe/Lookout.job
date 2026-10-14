# GitHub review, merge and deployment

Feature development stays in local worktrees; queue coordination runs on GitHub.

1. Refresh main, create a `codex/<feature>` branch/worktree and implement the feature.
2. Run local checks and open a non-draft PR against main.
3. Add `merge-ready`. The oldest ready PR by creation time is processed first.
4. The worker updates the branch against current main and explicitly starts CI
   after bot updates. It requests Copilot review and waits for a review of the
   current head, resolved review conversations and passing CI.
5. It squash-merges the exact tested head, explicitly starts production deploy,
   then waits for that deployment to succeed before processing another feature.

Failed tests, conflicts, unresolved feedback, unavailable Copilot or a failed
release stop advancement. Fix the feature branch or remove its `merge-ready`
label to let another feature advance. Fork PRs must be integrated into a trusted
repository branch by a maintainer. The queue never resolves findings itself or
claims that an advisory review is a human approval.

The queue wakes for PR changes, CI/deployment completion, manual dispatch, and a
five-minute scheduled reconciliation. Scheduled execution can be delayed by
GitHub. It needs no running Codex chat, external bot host, PAT, or paid merge-queue
service. Native GitHub merge queues are unavailable on this personal-account repo.
Copilot code review requires the account/repository to have Copilot review access;
review usage is billed by GitHub under that entitlement.

## Controls

- `merge-ready`: maintainer-controlled opt-in to automatic integration.
- Repository variable `MERGE_QUEUE_ENABLED=false`: pause the queue without
  changing branch protections. Dispatch **Review and merge queue** to reconcile.
- main requires the `CI` and `Copilot review` checks, current-main integration,
  resolved conversations, and pull requests; admins are included. See the
  applied configuration in `branch-protection.json`. Queue status is attached to
  the reviewed PR head; it cannot substitute a review of an old commit.
- Privileged queue events use `pull_request_target`/`workflow_run` and check out
  trusted main. They do not check out, import or run PR code. Tests run separately
  with a read-only token and without production secrets.
- Bot update/merge events do not trigger ordinary workflows with GITHUB_TOKEN,
  so the worker dispatches CI and deployment explicitly.

## Production

`deploy.yml` uses one `production-deploy` concurrency group with active deploys never canceled. GitHub may coalesce
pending workflow wakeups; the durable PR-label queue preserves ready features. It skips a stale commit if main already
advanced. The production export is built/tested before release; backend changes
are applied before publishing the matching frontend.

For automatic Supabase releases, add these **production environment secrets**:

- `SUPABASE_ACCESS_TOKEN`: a Supabase personal access token permitted for this project.
- `SUPABASE_DB_PASSWORD`: the project's Postgres password.

Restrict that environment to main. `SUPABASE_PROJECT_ID` is a non-secret repository
variable. Backend changes without credentials fail clearly and stop publication;
frontend-only changes still deploy. No secret belongs in source, PRs or artifacts.
The pipeline applies pending migrations and deploys the two custom-auth gateways;
it does not rerun the one-off company-logo seeding function.

Production migrations need backward-compatible rollout: a merged migration is
not automatically reversible if a later function/frontend step fails. Develop and
test schema changes locally or in a separate Supabase environment, never by
mutating the production database from a feature worktree.

[Copilot review](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/copilot-code-review)
· [GITHUB_TOKEN event behavior](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)
· [Concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
