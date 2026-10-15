# Weekly preparation planner

The Action Board has a rolling seven-day calendar and one preparation plan. It
opens on today's sessions; choose a calendar day or Show all week. Calendar dots
mark confirmed interview dates. Each session links to the covered interviews.
Company instructions, saved materials, email evidence, Lookout reports and
Glassdoor reports stay inside that interview's preparation section.

## Scheduling

The default daily budget is 45 minutes, configurable from 0 (pause) to 240. The
budget is shared across interviews and persists per account; guests use their
existing account-separated browser store and demo uses disposable memory.

`lib/preparation-planner.mjs` re-exports the canonical runtime-independent model
in `supabase/functions/agent-gateway/preparation-planner.mjs`. The website and MCP
use this same model. It includes only owned, open processes with confirmed dates
in the next seven calendar days. Later dates stay dormant, past deadlines require
review, and uncertain dates remain unscheduled. Confirmed terminal milestones
also close a process even when an older workflow status still says Interview.

Equivalent technical practice is grouped by focus (SQL, systems, coding, ML or
behavioral); generic resource work is grouped by the exact safe resource URL.
Company-specific resources, submitted materials, questions and logistics do not
merge. No sharing is inferred from arbitrary task titles or different company
reports. Unknown practice formats remain separate.

For each day, multiple-choice knapsack maximizes deadline-weighted interview
coverage within that day's remaining minutes. Closer rounds and recorded Apply
Now priorities receive higher weight. Progress reduces the remaining work. The
algorithm optimizes each day, not a global probability of interview success.
Sessions normally last at least 15 minutes; smaller budgets and final remaining
work can produce shorter sessions. Longer tasks continue on subsequent days.
All sessions finish on or before the recorded round date; date-only deadlines
cannot promise availability before an unknown interview time on that day.
Unfinished work that cannot fit is disclosed rather than exceeding the budget.

## Completion and storage

`preparation_planner_settings` stores the owned daily budget and optimistic
version separately from search settings, so general preference sync cannot
replace it. `preparation_sessions` is an owned, immutable completion ledger.
Recording a session consumes its minutes once and credits all listed interview
tasks. Partial sessions retain unfinished tasks until their required minutes have
been accumulated. Scheduling future work never completes it.

The owned RPC locks settings and all source plans, validates every plan version
and target before writing, then records the session and advances affected plan
versions atomically. A stale/foreign target rolls back the whole session. Retrying
the same session UUID and exact payload is idempotent, including through the
other transport. The signed-in owner or validated agent credential determines
ownership; clients never supply an owner ID. Today's completion ledger is
checked against the saved daily budget using the account's quiet-mode timezone
(UTC when none is saved). Individual legacy checklist completion remains a
user-reported task-state change, rather than a timed session.

Browser RPC / MCP mappings:

| Browser RPC | MCP tool | Scope |
| --- | --- | --- |
| `read_preparation_planner` | `read_preparation_planner` | `workspace:read` |
| `save_preparation_budget` | `save_preparation_budget` | `preferences:write` |
| `complete_preparation_session` | `complete_preparation_session` | `drafts:write` |

The existing `read_preparation_plan`, `update_preparation_plan` and
`complete_preparation_task` continue to manage individual interview plans.
Custom `resourceGuides` can include `source` (`lookout`, `glassdoor`, `official`,
`other`), `observedAt` (calendar date), and `evidence`. Lookout/Glassdoor reports
require a company match, date and supporting evidence. Resource URLs must be
HTTPS. Saved guides survive deadline replanning. Reports are sourced records,
not connected scraping, aggregation or inbox-monitoring services.

## Demo and validation

Admin demo includes two upcoming database interviews sharing SQL practice and a
resource, a company-specific fictional Lookout report, and an uncertain date.
Change the budget to 15, complete today's session and check both plan versions,
remaining practice and daily budget. Open an interview for its evidence. Reset
demo to restore the fixtures; no private account or employer writes are made.

Unit tests cover overlap, capacity, partial progress, date filtering, source
separation and transport contracts. Database tests cover owner isolation, scope,
versions, atomic rollback, immutable sessions and idempotency. Browser fixtures
exercise the real components/services and production CSS at mobile/desktop sizes.
Live sign-in and production deployment require separate verification.

Deploy migration `20261015205745_aggregated_preparation_planner.sql`, the gateway
(including its incremented developer context), remote MCP and frontend together
through the established production workflow after integration. Repository tests
and local demo do not establish deployed MCP parity or connected intelligence feeds.
