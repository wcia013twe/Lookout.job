# Feature merge queue

Open a non-draft PR against main and add `merge-ready` after local checks pass.
GitHub processes the oldest labelled PR first: update against main, run CI,
squash-merge the exact tested commit, and deploy. The next feature waits for the
previous deployment to succeed. Conflicts or failed checks stop that PR; fix it
or remove its label to let another feature advance.

The worker runs on PR changes, CI/deployment completion, manual dispatch and a
five-minute schedule. GitHub can delay scheduled runs. It runs trusted main code,
never PR code with write credentials. Bot updates explicitly dispatch CI and
bot merges explicitly dispatch deployment.

Set repository variable `MERGE_QUEUE_ENABLED=false` to pause. Dispatch
**Feature merge queue** to reconcile. Main requires passing `CI`, an up-to-date
branch, resolved conversations and a PR, including for admins. Fork PRs need
maintainer integration into a repository branch.

Deployment is serialized through `production-deploy`. No Copilot subscription
or running Codex chat is required.
