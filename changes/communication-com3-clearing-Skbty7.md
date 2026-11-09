# COM03 fresh-owner reset clearance

- PILOT05 failed before inference: globally fixed application UUIDs collided with a historical owner. Both setup failures and their exports are retained; no participant model ran.
- COM3-stream-v5 remaps application UUIDs deterministically per dedicated owner, including linked contact tags. Fixture semantics and rubric remain unchanged (COM3-grade-v4).
- Full reset now runs in a rolled-back preflight transaction before inference, verifies seeded Submitted/no-receipt provenance, and catches global collisions. No real account reset or unrelated owner writes.
- Validation: 12 focused Python checks, five Node harness checks, native audit/seed/scope checks and actual no-inference preflight pass; catalog validation passes (158 roles). Locked dependencies installed.
- PILOT07 reuses the unused isolated owner and existing infrastructure. Earlier frozen checkouts remain intact, including the live PILOT06 COM04 source. No product changes, pushes or deployment.
