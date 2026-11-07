# Larger logos and hidden card ranking

- Increased role-card company marks from 40px to 64px desktop / 56px mobile. Profile background marks now use 80px desktop / 64px mobile. Scaled fallback and project glyphs with their larger marks.
- Temporarily commented out the role-card ranking badge. Saved ranking settings and card color treatment are preserved for later reuse.
- Validation: frontend typecheck, final production build and 158-role catalog validation passed. The initial full suite had 6 disk-space-related failures; after removing generated artifacts from completed task checkouts, all 13 tests in the affected live-main and search-pipeline files passed. All remaining full-suite tests passed (5 skipped).
- Browser checks measured card marks at 64px/56px, confirmed ranking badges absent, and passed profile/card loading, fallback, reset and desktop/mobile no-overflow checks. Screenshots inspected; mechanical design detector returned no findings.
- No backend/account changes, push or hosted deployment.
