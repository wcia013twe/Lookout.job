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

## Focused Career Ops parity audit

Run `npm run test:filter` for offline filtering coverage, including direct calls to
pinned `scan.mjs` predicates and a real runner-child invocation. Fictional inputs
and a fixed clock exercise title/content rules, age/date boundaries, salary
range overlap/currency, sponsorship policy, location precedence/Workday hints,
reapplication cooldown, typed preferences and conservative missing-data behavior.
This command does not fetch jobs, invoke an LLM or write database records.

The reread found an adapter error: it changed every missing-evidence result to
unknown, even when Career Ops explicitly rejected it. This bypassed
`visa_filter.require_mention` and strict location policy. It also treated a raw
`portals.location_filter` rejection as a soft preference, and disregarded URL-only
location evidence. The adapter now preserves those upstream failures. A
conservative upstream pass without evidence remains unknown, retained for review.
Saved profile location preferences still honor Required/Preferred/Flexible.

This is parity for the listed adapter gates, not the whole scanner. The upstream
scan loop also implements company title overrides, declared-field filters,
blacklists, tier skipping, deduplication and trust handling; importing its files
does not make all of those part of `filterDiscovery`. Profile location selections
currently replace the portal location predicate rather than composing with it.
The work-arrangement adapter reuses a geography predicate with a remote-title
fallback, so it needs a separate exact work-policy test/contract before claiming
strict Hybrid-only or On-site-only matching. Freeform profile pay is not converted
to a salary rule. Salary uses range overlap, not a guaranteed minimum offer.
These are remaining boundaries, not capabilities established by this suite.

Career Ops itself uses configured textual rules and conservative missing-data
passes. It does not compute the six full applicant-eligibility checks listed
above from a résumé. Those need explicit evidence/rules or agent review; they
should not be presented as implemented by copying the scanner.

## Connected Career Ops configuration and extraction

The current adapter uses the unchanged pinned `validate-portals.mjs` CLI,
`audit-portals.mjs` offline query/provider checks and `classify-tier.mjs` in
addition to the previously connected predicates. No vendor matcher is changed.
`read_search_filter_plan(profileId)` authorizes through existing owned search
context reads, validates current versions and returns effective config, gaps,
validation findings, offline source handoffs and provenance. This is a Node read;
Edge-only callers receive an explicit Node-service handoff. No network search,
settings write or new database table is part of inspection.

Muse saves scanner controls in the existing versioned profile document, preserving
frontmatter and all other narrative:

```markdown
## Career Ops discovery filters
```

Follow that heading with one fenced `json` object, for example:

```json
{
  "title_filter": {"positive": ["Backend", "Software Engineer"], "negative": []},
  "skip_tiers": ["senior"],
  "location_filter": {"allow": ["New York", "Remote"], "block_hard": ["Brazil"], "strict": true}
}
```

These are fictional targeting examples, not default user criteria. Supported keys
are title_filter, skip_tiers, location_filter, max_posting_age_days, posted_after,
posted_before, content_filter, country_eligibility_filter, visa_filter, salary_filter
and re_apply_windows. Each local key replaces that shared fallback key for this
profile only. The codec rejects malformed sections; inspection and execution run
the original validator plus bounded transport/typo guards. Existing save/read
operations preserve ownership, revisions and retry behavior. Browser edits and
MCP writes use the same codec and worker screening.

Saved Roles without usable positive keywords block collection unless a local
title_filter is explicitly present (an empty one is deliberately broad). Muse
uses the imported titles procedure to derive role-family terms from evidence;
the backend does not guess synonyms from literal labels. New goals and intentional
retirements remain meaningful choices.

Explicit profile location_filter is a hard scanner policy. Without one, the
existing profile Location preference retains its configured strength and the
shared hard location policy also applies; it is no longer silently replaced by
the soft preference. There is no geographic-radius engine. Country-limited remote
work and actual applicant experience still require evidence review. skip_tiers
is title classification only: plain titles fall into upstream's mid bucket.

The JD intake now calls the original fetchJdViaKnownApi dispatcher for Lever,
Ashby, Workday, SmartRecruiters and embedded Greenhouse. Ordinary Greenhouse
continues to use normalizeGreenhouseJob. Liveness must be confirmed independently.
Full text alone is insufficient to save a record: missing company attribution
or posting identity remains failed extraction, without changing active liveness.
Matching owned source names can attribute an employer only when the posting
belongs to that exact configured board; aggregate labels are never promoted.
Unknown dates remain null.

Limits: no full scanner-loop replacement, arbitrary local parsers, source-budget
increase, automated résumé eligibility engine, rank-based publication threshold
or rewriting of historical batches. Muse must select relevant opportunities
from the review queue before publishing. Hosted deployment and live external ATS
coverage require separate verification.
