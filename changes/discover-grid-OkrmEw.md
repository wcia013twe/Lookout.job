# Discover card grid alignment

- Discover uses a simple one-column mobile / three-column desktop grid (768px breakpoint). Cards keep the same column width even when a section has fewer than three roles. Shared CSS subgrid tracks are used to align titles, facts, summaries, match previews and actions within each row. Long titles remain fully readable; narrow screens use one column.
- Unassessed card previews show a compact message instead of four empty factor bars. Expanded detail retains the assessment explanation. Existing public catalog behavior and queue/preview actions are unchanged; no backend or MCP contract change.
- Demo coverage: a fictional long-title role exercises alignment beside an illustrative scored card. Updated the browser check to use detached demo entry, stable reduced-motion measurements, and assertions for shared row alignment and absence of empty score bars.
- Validation: data validation (147 roles), TypeScript, production static build, 24 demo/isolation tests, Impeccable detector (no findings), and production-browser interactions at 1440px dark and 390px light all passed. Screenshots inspected at both sizes.
- Verification limits: Chrome only; browsers without subgrid retain the flex-card fallback. Development preview stalled at workspace loading; validation used the production static export. No live account/backend operations or deployment performed.

- Follow-up: replaced auto-fit sizing with `grid grid-cols-1 gap-4 md:grid-cols-3`; removed the custom catalog-grid CSS. Data validation and TypeScript passed. Existing demo fixtures cover sparse and full rows; prior browser verification covers the retained card alignment.
