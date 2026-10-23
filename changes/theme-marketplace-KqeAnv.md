# Theme marketplace

- Removed None from both appearance pickers and its grayscale CSS. Stored None preferences now resolve to System before first paint; updated regression coverage for both device palettes.
- Added `/themes/` from profile navigation and appearance controls. Inspired by the supplied Better Canvas reference: large Dashboard/Circles preview beside a searchable gallery, category filters, name sorting, selected states, and session-only Saved collection. Six bundled palette concepts and authored fictional preview content; mobile layout stacks preview and gallery.
- Reused the same isolated sample renderer in regular/admin demo mode. Demo walkthrough covers surface switches, selection, favorites, empty search, and reset by leaving the page. No private data, backend writes, purchases, or installations. Documented the explicit human interaction boundary; account theme MCP remains unchanged.
- Validation: production static export (51 pages including `/themes/`) and TypeScript passed; data validation passed (76 roles); appearance regression tests passed; mechanical design detector returned no findings; git diff --check passed.
- Limits: marketplace is browse/preview only. No community submission, installed themes, persistence of favorites, deployment, or production MCP parity. Browser screenshots and interactive viewport verification were unavailable in this session; responsive behavior reviewed from source. Full-suite result recorded below.
- Full suite: 413/413 passed outside sandbox subprocess restrictions. The initial restricted run reported three file-level failures; complete outputs preserved at `/tmp/theme-marketplace-tests.log` and `/tmp/theme-marketplace-tests-unrestricted.log`.
- Delivery: `/tmp/lookout-features/theme-marketplace-KqeAnv/repo`, branch `codex/theme-marketplace-KqeAnv`; local main only, nothing pushed or published. Shared-main `.serena/` and `docs/research/` remain untouched.

## Follow-up: simplified browsing

- Removed search, category filters, sorting controls, and their unused state/styles. Browse/Saved, preview selection, and Dashboard/Circles remain. Updated demo walkthrough to exercise the empty Saved state.
- Validation: data validation, frontend typecheck, and diff whitespace checks passed. No backend or MCP behavior changed; browser visual inspection was not performed.

## Follow-up: profile navigation label

- Renamed the profile dropdown link to Browse Marketplace, preserving its destination and behavior.
- Validation: data validation and diff whitespace checks passed; copy-only change.
