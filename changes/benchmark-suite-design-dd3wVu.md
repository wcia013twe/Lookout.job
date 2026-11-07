# benchmark-suite-design

- Define a proposed 20-scenario benchmark: 15 personalized page decisions and
  five connected workflows, with paired direct-agent/Lookout arms and 80–120 episodes.
- Specify fictional inputs, requests, expected outcomes, independent grading,
  evidence requirements, cost controls, launch gates and research-claim limits.
- Validation: reviewed counts, pairing, counterfactual tasks, state isolation,
  grading provenance and current audit documentation; `git diff --check` passed.
- Limits: design only. Fixture assets, baseline execution, independent capture,
  runner and graders are not implemented or verified by this change. No runs,
  database changes, deployments or external actions were performed.
