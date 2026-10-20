# Simple Referrals

- Start empty Referrals with a compact company request form; remove repeated setup actions and keep templates collapsed.
- Seed admin and Muse demos with independent fictional drafts, opening the colored referral message immediately on desktop and mobile. Editing, copy, status and reset stay in the existing isolated demo store.
- Give the message full width, move the color key below it, and show sentence notes only on selection.
- Existing MCP boundaries are unchanged: `read_outreach_workspace` and `save_outreach_package` serve real outreach; this pass changes presentation and fictional fixtures only.
- Validation: all 369 tests, `npm run validate:data` (76 roles), production build, `git diff --check`, Impeccable detector (no findings), and `node scripts/check-referrals-ui.mjs` passed. Browser coverage includes desktop/mobile drafts, highlight toggles, collapsed templates, local edits, contact navigation and no cloud writes during demo edits.
- Limits: real authenticated outreach preparation and sending were not exercised; no backend contract or deployment changes.
