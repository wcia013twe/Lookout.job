# Circle list banners and company logos

- Each Circle in Your circles uses the existing cloud-cottage artwork as its background. Its name, membership label, Open Circle/Manage controls, company-logo stack and loading/empty messages all live on the banner, with a dark image scrim for contrast. Up to eight company logos appear; additional companies show a count. Mobile keeps everything within the banner without horizontal overflow. The decorative background is not a wrapping button, so interactive controls remain separate accessible buttons.
- Only published current revisions returned by the existing scoped knowledge.search operation contribute company names, including shared context and offer comparisons. Drafts do not populate the stack. Loading, empty, request-error and missing-logo fallback states are handled; request cleanup prevents stale results after unmount/account changes.
- No new service, schema, write action, access permission or MCP contract. The website uses the same existing knowledge.search ownership/visibility boundary as scoped agent reads; existing unit/database tests cover both human and agent access. No live hosted MCP or authenticated Circle round trip was performed.
- Demo coverage: existing fictional posts supply Databricks, Robinhood, Stripe and NVIDIA logos. The resettable isolated Circle preview describes the new banner and logo stack; no real account data or external writes were used in verification.
- Validation: npm test (412 passed including database scenarios); npm run validate:data (147 roles); production build/static export and TypeScript passed; git diff --check; scoped Impeccable layout detector (no findings). Browser inspected the built preview at desktop and 390px mobile (scroll width 390px); verified visible banner/logos and Open Circle navigation, with a final desktop crop confirmation. Hosted data availability, every multi-Circle loading/error combination and custom per-Circle banner uploads were not exercised; this pass reuses the existing shared banner asset.
- Delivery: landed locally; nothing pushed or published.

## Banner background refinement

- Moved every Circle-specific label and control onto the artwork, increased the background area for comfortable desktop/mobile composition, and updated fictional preview guidance. No data/service/MCP behavior changed.
- Validation: production build/static export and TypeScript passed; data validation (147 roles); git diff --check; scoped layout detector (no findings); desktop and 390px mobile browser inspection confirmed all text, logos and buttons within the banner, visible keyboard focus, and no horizontal overflow. The 412-test result above is from the initial feature pass; the full suite was not repeated for this layout-only follow-up. Nothing pushed or published.

## Icon controls

- Replaced the Open Circle and Manage text buttons with an enter icon and settings gear in the banner’s upper-right corner. Both retain action-specific accessible names, native title tooltips, 44px targets, visible keyboard focus, hover and disabled states. Extra content clearance protects long titles from the controls. Reduced-motion preferences disable button transitions.
- Updated the fictional preview guidance. Existing navigation/service/MCP boundaries remain unchanged.
- Validation: production build/static export and TypeScript passed; data validation (147 roles); diff whitespace check and scoped layout detector passed. Desktop/390px mobile screenshots confirmed compact controls and no horizontal overflow; browser clicks verified the gear opens Circle settings and the enter icon opens Clubhouse. The full suite was not repeated for this presentation-only refinement. No hosted calls, push or publication.
