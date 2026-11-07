# Recover long-running search workers

- Renew live search leases every 30 seconds through a service-only, token/version-fenced heartbeat. Reject expired/replaced/revoked ownership without changing the job fence. Stop heartbeats after completion; leave interrupted/shutdown work reclaimable under the same job/run.
- Save each verification batch before a versioned source checkpoint. Resume from persisted identities rather than trusting offsets in changing upstream responses. Retain bounded recent diagnostics with an explicit omitted count. A rejected checkpoint cancels sibling source tasks and prevents further collection.
- Propagate cancellation to provider requests and isolated task process groups; terminate browser descendants on timeout/cancellation/child exit. Enable Docker init to reap exited descendants.
- Add a fictional resumed-run demo with a saved 25-record batch and no external requests or account writes.
- Validation: full npm test -- --test-concurrency=4: 1,014 passed, 5 skipped, zero failures. Subsequent focused cancellation/heartbeat checks: 5 passed. SQL recovery tests include renewal without changing fences, rejection of expired/wrong/revoked leases, and interruption after 25 saved observations followed by same-run recovery to 61 without duplicates. Runtime TypeScript, validate:data (158 roles), and diff checks passed.
- Limits: no hosted deployment. Local Docker rollout and resumed-run verification will be recorded below. Source reachability and complete market coverage remain provider-dependent; this change does not add historical-analysis caching.
