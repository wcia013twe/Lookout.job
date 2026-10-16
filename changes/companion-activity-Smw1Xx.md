# Companion activity cards

<!-- change-fragment: complete -->

- Clicking a clubhouse companion opens its member's shared activity: up to three authored highlights, an optional weekly goal and an optional request for help. Published posts provide the fallback; private drafts and noncurrent revisions are excluded. Missing updates have an empty state. No private applications or presence are inferred.
- Added Share activity fields to the Circle composer. Plain-text sections preserve the existing scoped website/MCP contribution contract and review/publication flow. Counts remain member reports. Cheer and help open the appropriate shared thread for a reviewed reply; no message is sent automatically.
- Simplified Circle navigation to Clubhouse, Company Intel and Resources. Clubhouse opens by default; interview/offer/company contributions share Company Intel. Replaced the recommendations rail with general Circle chat and a freeform composer using the existing reviewed discussion flow.
- Added member paging, pause-on-open, Escape/close focus restoration, and a mobile bottom sheet. Shared-update navigation clears collection filters and scrolls back to conversations.
- Fictional demo covers Alex's complete activity/request, Sam's progress without a request, ordinary posts, Wesley's empty state, and existing draft/reply/publication/withdrawal paths. Documented MCP tool mapping in backend/circle-knowledge.md.
- Validation: 345 tests passed, frontend typecheck, 76-role data validation, static build and UI detector passed. Browser verified desktop/mobile layouts, all three navigation destinations, activity cards, help navigation, and private-draft saves for both activity updates and freeform chat.
- Limits: authenticated hosted accounts were not exercised. Cards summarize loaded published posts. No push, PR or production deployment. Frontend npm ci ran out of disk space; temporary install files were removed and existing installed dependencies used for checks. The initial disk-interrupted test run passed on retry. Disk also interrupted a later export; final verification disabled the temporary webpack disk cache without changing the delivered configuration.
