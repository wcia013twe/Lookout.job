# Restore the original Discover colors

- Withdraw the cotton candy palette. Restore Discover cards, feed, pack styling, profile styles, annotations, role material colors and tracker styling from immediately before 0b529a4. Preserve the earlier amber tracker contrast change.
- Keep the extracted Tailwind v4 base palette in next-app/app/theme.css, with the exact previous values and cascade. Expanding its import reproduces the original globals.css byte-for-byte. Discover component/feed/material source files also match their pre-pink versions byte-for-byte.
- Preserve newer Clubhouse layout and ivory-bubble changes. Replace one leftover pink-only token reference with the existing tag token. Correct design/theme documentation to describe the restored appearance.
- Validation: 357 tests passed, data validation passed (76 roles), static production build and its TypeScript check passed (50 routes), git diff --check passed. Detector reported only the incumbent Inter font. Existing demo fixtures inherit the restored styles; no fixture data or service/MCP actions change.
- Limits: restoration verified through exact source comparisons and build, without a new interactive browser pass.
- Checkout: /private/var/folders/rd/g5mh_z7s1g56b0dhk7_3xwv00000gn/T/lookout-features/restore-discover-colors-gJesjl/repo; branch codex/restore-discover-colors-gJesjl. Delivery is local main only; nothing pushed/published. Existing unrelated shared-main edits are preserved.
