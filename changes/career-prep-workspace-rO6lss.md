# Career Toolkit artifact workspace

- Added private versioned documents and self-contained interactive HTML, workspace search, direct links, revision history, archive/restore and exact-version agent discussion references. Existing tools/manuals remain available.
- Added scoped artifact/learning-goal MCP tools sharing browser ownership, validation and concurrency checks. Developer version 34 instructs authorized planning runs to proactively prepare useful materials and report saved links or partial failures honestly.
- Extended the canonical weekly planner and completion ledger to learning goals alongside interviews, using one budget with interviews first. Tasks link to artifacts and disclose missing material; preview activity never records practice.
- Demo: fictional prep pack, company brief, interactive scan-cost exercise and missing-material task, with disposable archive/revision/session interactions. Account sync now pauses during demo and resumes afterward; late account refreshes cannot hydrate demo state.
- Validation: all 423 repository tests passed after integrating current local main, including database scenarios and demo sync suspension. Data validation (147 roles), frontend typecheck, production static build and diff checks passed. Browser verification passed desktop/mobile rendering, interactive slider/explanation, exact-version discussion, archive/restore/history, research, task links, missing material, parent/storage/network isolation and zero demo account calls/page errors. Impeccable detector: no findings; independent finish review: ship; design documentation check: no system changes needed.
- Limits: migration/gateway/config/MCP/frontend need the normal coordinated production release and hosted verification. No external scheduler, automatic chat handoff or live generation runtime was activated. Interactive activity state is temporary.

## Visual refinement

- Replaced description-heavy divided rows with a materials shelf: slate-blue weekly prep, mint interactive materials, lavender research and neutral document covers, with explicit light/dark roles. Only the featured prep pack includes its purpose in the shelf; full content stays in the reader.
- Removed repeated page headings and most outlines/separators, introduced quiet segmented section navigation and surface-based filters, and moved revision/archive/source controls into Material details. The reader places the material higher and gives agent discussion the primary action.
- Reused real artifact metadata and fictional demo fixtures; no generated preview screenshots or new backend actions. Existing MCP mappings and artifact isolation remain unchanged.
- Validation: frontend typecheck/build, 147-role data validation, 11 targeted artifact/toolkit tests and the full browser artifact flow passed. Dark/light desktop and mobile captures inspected; cover secondary-text contrast is at least 5.57:1. Detector reports no findings. Independent visual review returned ship with no material fixes after a malformed Chrome capture was replaced. Scoped design documentation records the implemented palette and reading layout.
- Limits: this pass refines Career Toolkit and its reader; the shared app theme and agent-generated HTML designs are not rewritten. Hosted release requirements from the original pass still apply.

## Simplified skill pages

Replaced the repeated inputs/procedure/outputs/setup sections, example chooser,
application picker and manual sidebar with the requested overview, Skill.md iframe
and single copy-invocation button. Script-free static documents render the same
adapted guide and pinned source documents returned by `read_guide`; no account data
is embedded. The copy request uses that existing scoped MCP boundary and preserves
fictional demo restrictions. Clipboard failure offers a selectable request.

Validation: seven Career Toolkit tests pass, including all 37 document/guide
mappings and demo invocation boundaries; production static build and data validation
pass. Desktop/mobile browser checks cover document loading, copy text, fictional demo boundaries, clipboard fallback and overflow. Typecheck and diff checks pass; detector found no issues and independent finish review returned ship.
Public instructions only; no backend release or live connected-agent execution tested.

## Category heading boxes

Wrapped Toolkit category headings in Discover’s shared `glass-inset` box styling,
including the selected category header. Removed the old overview top rule.
Validation: frontend typecheck, static production build, data validation and desktop/mobile browser checks pass. Detector reports no findings.
No new actions or backend contract changes.

## Shared box component

Extracted Discover’s existing inset box into `InsetBox` in shared UI. Discover
and Toolkit category headers now render that same component, with no duplicated
box classes. Appearance and behavior are unchanged. Validation: typecheck, static
build, data validation and diff checks.

## Inline skill document fix

Skill iframes now embed the generated Markdown HTML directly using `srcDoc`,
with an empty sandbox. They no longer fetch a document URL that can fall back
to the app shell on a development server or missing-file host. Documents remain
script-free and contain no account data. Validation: static build, typecheck,
data checks and browser assertions for embedded content with no iframe URL.

## Skill document runtime correction

Removed the runtime read of generated public HTML. Skill pages now compile their
canonical Markdown directly with a server-compatible Markdown compiler and embed
the result using srcDoc. This works when public/skill-documents does not exist,
including an already-running development server after local landing. Removed the
public document generator; added explicit Markdown compiler dependencies.
Validation: all 37 documents tested from source, typecheck, production static
build, data validation and browser iframe checks.
