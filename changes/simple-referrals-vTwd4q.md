# Simple Referrals

- Start empty Referrals with a compact company request form; remove repeated setup actions and keep templates collapsed.
- Seed admin demo entry/reset and Muse fixtures with independent fictional drafts, opening the colored referral message immediately on desktop and mobile. Editing, copy, status and reset stay in the existing isolated demo store.
- Give the message full width, move the color key below it, and show sentence notes only on selection.
- Existing MCP boundaries are unchanged: `read_outreach_workspace` and `save_outreach_package` serve real outreach; this pass changes presentation and fictional fixtures only.
- Validation: all 369 tests, `npm run validate:data` (76 roles), production build, `git diff --check`, Impeccable detector (no findings), and `node scripts/check-referrals-ui.mjs` passed. Browser coverage includes desktop/mobile drafts, highlight toggles, collapsed templates, local edits, contact navigation and no cloud writes during demo edits.
- Limits: real authenticated outreach preparation and sending were not exercised; no backend contract or deployment changes.

## Automatic account sync

- Remove the persistent Synced/Retry sync/Load account bar and referral retry/load controls. Account reads refresh every 15 seconds and on focus, visibility and reconnect; failed reads and writes retry automatically. Errors remain visible while edits stay local.
- Background reads discard their response when local edits, an account switch, or a protected application transition intervenes. Existing revision/ownership checks remain authoritative; a conflicting revision is never force-overwritten.
- Outreach retries its initial connection and pending writes automatically. Demo changes remain memory-only. No new product action or backend contract: existing `workspace_read`, `read_outreach_workspace`, and scoped draft tools retain their validation.
- Verification: all 385 tests, 76-role data validation, production build, and browser regression check passed. Browser coverage simulates a failed referral save and confirms automatic recovery without a retry button, plus absence of account controls and isolated demo edits. Live multi-device authentication and real network failure recovery are not exercised.

- Demo entry/reset seeds shared fictional contacts in the workspace provider, leaving the concurrently edited base demo module untouched.
