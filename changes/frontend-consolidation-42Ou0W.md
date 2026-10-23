# Frontend consolidation

- Consolidated profile section/card framing, application preview field lists, and Circle post-date formatting without changing styling, copy, routes, data ownership, or action contracts.
- Audit intentionally leaves shared domain adapters and account synchronization intact; their differences are behavioral, not disposable duplication. No dependencies or service/MCP actions added.
- Validation: all 459 repository tests passed; frontend TypeScript check passed; static production export passed (54 pages, 370 public offline assets); catalog validation passed (147 roles); UI detector returned no findings; git diff --check passed.
- Parity: nine old/new server-render comparisons passed for preview/profile components, covering empty/full/falsy fields, disabled sections, cards with icons/actions, and value fallbacks. React IDs normalized and CSS module names stubbed consistently. Seven date parity checks covered timezone/day boundaries, DST, and invalid/empty values.
- Demo: existing fictional fixtures and demo isolation tests remain applicable and passed. Profile and preview demo verification instructions now explicitly cover the shared rendering. No new product states require new fixture data.
- Limits: no browser screenshots or edit/save interaction walkthrough; SSR checks prove initial markup only. Existing Next.js security advisory interrupted the first build; retry completed. Dependency upgrade deferred.
