# Discovery filtering contract, first correction

The shared contract is `lib/discovery-filter-contract.mjs`. Runtime validation and
exported TypeScript types cover employment, work arrangement, constraint strength,
source-field types and the existing screening result/check vocabulary. The
original Career Ops matching predicates remain the implementation.

## Typed values

- Employment: FT, Internship, Part-time, Contract, Temporary.
- Work arrangement: remote, hybrid, on-site.
- Strength: required, preferred, flexible, not-configured.
- Check status: met, unmet, unknown, not-applicable.
- Result: ineligible (a required discovery constraint rejected it) or review-needed
  (retained, with eligibility still unevaluated). The legacy passed flag means
  retain for review. It never means a complete applicant match.

Existing settings strings are normalized once at the adapter boundary. Multiple
choices remain multiple values. Unsupported values, duplicate priority labels,
contradictory Any plus specific values, malformed source fields and malformed
results reject. This does not replace the current versioned settings store.

## Honest evaluation scope

Fresh and replayed service responses expose contractVersion 1, evaluationScope
`discovery-gates`, and applicantEligibility `not-evaluated`. Disabled predicates
produce not-applicable, not met. Configured predicates without source evidence
produce unknown. Required failures exclude; Preferred/Flexible conflicts remain
available for review. Unknown required evidence does not prove eligibility.

Experience, graduation, availability, authorization, prior-application and
company-limit checks remain explicitly unevaluated. Unused applicant facts are no
longer forwarded into the filter child. This correction does not implement those
checks, new source providers, catalogue pagination policy, or personal scoring.
Location/pay and other legacy upstream configurations still need their own typed
contracts. Provenance/recency and application-field resolution are separate next
corrections; they are not declared fixed by this contract.

Existing saved screening fields are not rewritten; service responses add the explicit discovery-only scope. A new evaluation
uses a fresh event key and the current settings version; old keys replay old data.
No table, migration, approval or submission permission is added.

Validation: normalization and malformed-input cases, actual copied predicates,
unconfigured/unknown distinction, multi-choice work settings, result guards and a
TypeScript compile fixture with expected type errors.
