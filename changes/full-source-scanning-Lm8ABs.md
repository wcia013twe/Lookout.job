# Full source scanning

- Replace the ten-source sample with a Career Ops style pool of up to ten concurrent source tasks across all configured run sources. Preserve completed checkpoints, fenced persistence, canonical deduplication, and version checks. Drain active tasks before propagating failure.
- Remove the 250-discovery shortlist cap and 5,000-row retry/screening traversal caps; retain advancing-cursor validation and bounded write batches.
- Update the fictional search demo to cover twelve completed employer sources and an unresolved aggregate, with no external requests. Update current flow documentation.
- Validation: full npm test: 987 passed, 5 skipped, zero failures; subsequent focused screening/context checks: 18 passed. Runtime TypeScript check, validate:data (158 roles), and diff checks passed.
- Limits: no live provider sweep or load test; no deployment. Per-source 25-lead, three-page/request, child timeout/output budgets and five-minute job leases remain. Full-catalog attempts do not imply exhaustive board pagination or eligibility.
