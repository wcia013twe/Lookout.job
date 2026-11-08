# Shared Action Board calendar

Weekly prep reads current application rounds even without plans, explicit imported next actions and scheduled Toolkit mocks from one owned snapshot. Existing editors and versioned writers remain authoritative. Completed, cancelled and archived work leaves upcoming dates; mocks never become employer interview rounds. Visible refresh runs every minute and on focus/account sync. Fictional demo sources cover the same projections.

Validation: npm test passed (1,068 passed, five skipped); validate:data passed (158 roles); frontend typecheck and production build passed. Connected-board desktop/mobile flows passed and screenshots were inspected, including imported actions, mocks and rounds. Owned browser/MCP snapshot, lifecycle, timezone and resettable demo regressions passed. Migration 20261108005048 was applied to the existing local database and owned reads passed in a rolled-back check; no personal record was changed. Local API image lookout-node:shared-calendar and mounted Edge code were refreshed; the existing worker and separate resume API stayed running. The disposable Node MCP → Edge → SQL mock proof passed save/read/retry plus planner calendar read-back and private-profile exclusion; fixtures were removed. The existing frontend returned HTTP 200. No hosted deployment or external Calendar changes.


## Full-week follow-up

Shows all seven Monday–Sunday days and adds week navigation. Pending undated assessments and tasks excluded by date/budget remain visible with honest reasons and source links; no dates or completions are invented. Scoped account diagnosis established that undated imported OA rounds were omitted; no personal records or preferences were changed. Website/MCP share week selection and the pending projection. Contract 126, interview guide 9 and change-feed version refs match. The existing detached board scenario adds an undated fictional assessment.

Validation: 38 focused planner, scope, week validation, ownership and guide checks passed. Full suite: 1,071 passed, five skipped. Typecheck, data validation (158 roles) and production build passed. Desktop/mobile checks passed seven-day visibility, week navigation, undated assessment visibility, exact review/cancellation and no horizontal overflow; screenshots inspected. Local API image lookout-node:calendar-week and mounted Edge code refreshed; worker and resume API preserved. Disposable mock save/read/retry and selected-week calendar proof passed and removed fixtures. Connected owned read-back returned all seven dates for current/next weeks, retained three previously omitted undated assessment rounds, and showed the saved mock plus two employer rounds in the next week. Compared owned imports, plans, goals and mock logistics before/after: unchanged. Private diagnostic audit was saved and read back. No personal source records were changed.


## Next-action precedence and duplicate correction

Imported next-action dates remain visible independently of needsAction. A lone undated unfinished round uses its existing next-action entry instead of an additional misleading undated entry. Current round dates suppress a duplicate same-day application action, in the calendar and pending list; different dates and multiple rounds remain distinct. The projector never edits stored dates. Calendar action links now show company and description. Demo covers a dated next action with no attention flag and an undated round. Contract 128 and interview guide/change-feed 10 match.

Validation: 40 focused calendar/ownership/version checks passed; typecheck, data validation (158 roles), production build and desktop/mobile checks passed. The fixture proves next-action dates survive a false attention flag and no misleading undated assessment duplicate remains. Full suite passed: 1,073 passed, five skipped. After integrating the concurrent Network change, 13 calendar/Network checks and typecheck passed; the integrated production export passed. Local API image lookout-node:calendar-action-dates and mounted Edge code refreshed with existing compose settings; worker/resume services preserved. Disposable mock/calendar smoke passed and removed fixtures. Connected owned reads verified all five user-identified application events occur exactly once on their stored/corrected dates across three selected weeks; misleading undated assessment duplicates are absent. One explicit user-reported date correction was saved and read back through the scoped imported-record writer, retaining historical evidence; private details stay in owned records/audit. No standalone calendar table, push or hosted deployment. Personal date corrections stay in owned records and are not part of this repository change.


## Upcoming relevant-date view

Restores a compact upcoming timeline that skips empty/past days and includes future dates beyond the current week. Adds small Today/In X days tags. Keeps undated/overdue tasks separate and retains all existing date sources and duplicate fixes. The owned planner reader and weekOf capability are unchanged. Round types are retained when dated pending items enter the timeline. Validation: 10 focused view/calendar checks passed, including calendar-day tags across DST and month boundaries; frontend typecheck, 158-role data validation and final production export passed. Connected desktop/mobile flow verified omitted empty days, relative tags, dated company cards, undated tasks, round cancellation and no horizontal overflow; screenshots inspected. Visual artifacts were moved to the external SSD after an internal temporary-volume write ran out of space. No personal data changes, push or hosted deployment.

Integrated verification after concurrent inline Action Board landing: 19 focused calendar/connected-board checks, frontend typecheck and production export passed. The combined desktop/mobile flow passed upcoming-date tags, omitted empty days and the new inline decisions on isolated port 3119. Another session’s port-3107 preview was preserved; the initially blocked port check was not accepted as evidence.


## Tiny calendar company logos

Calendar events and rounds use a 20px variant of the existing shared company logo component, with the existing fallback for unknown companies. Non-company prep retains its calendar icon. Images lazy-load and decode asynchronously. Display sizes share the same canonical CDN URL, so normal browser/CDN caching can reuse a company image across surfaces; no database, duplicated assets or service-worker cache was added. Validation: eight existing logo/cache and upcoming-view checks passed, frontend typecheck and production export passed, data validation passed (158 roles). Detached desktop/mobile checks verified 20px shared marks, labels, no overflow and existing decisions; screenshots inspected. Fictional logos use local fallbacks. This verifies URL reuse and rendering, not live CDN cache-hit rates or response TTLs. No push or hosted deployment.


## Palantir logo consistency and day spacing

Maps Palantir and Palantir Technologies to palantir.com so they reuse exactly one logo URL/cache entry. Reduces calendar day vertical padding from 16px to 12px per edge and the extra inter-day margin from 8px to 4px; card spacing is unchanged. Validation: five logo-alias/upcoming-view checks passed; frontend typecheck, data validation (158 roles) and production export passed. Detached desktop/mobile flows and screenshots passed the spacing review. The alias test verifies identical Palantir CDN URLs; no live CDN cache-hit claim. No push or hosted deployment.


## Theme-aligned action-card colors

Replaces broad pastel fills with restrained material tints mixed into the active workspace panel. Review work uses lavender/blue, interviews teal, outreach blue and blockers muted amber. Text inherits the active theme, controls blend with the card and borders follow the accent. Existing card anatomy, decisions and behavior are unchanged. Validation: frontend typecheck, data validation (158 roles) and production export passed. Detached desktop/mobile action flows passed. Four light/dark desktop/mobile screenshots were inspected; sampled headings, labels and helper text had minimum contrast 6.17:1 light and 7.10:1 dark, and no horizontal overflow. This CSS-only pass adds no product action or backend change. No push or hosted deployment.


## Embedded application contrast

Separates minimized application summaries from tinted action cards using a neutral white/deep surface, a stronger theme-derived border and subtle elevation. Scoped to the Action Board embedding; shared application cards elsewhere keep their existing styling. Validation: frontend typecheck, data validation (158 roles) and production export passed. Detached desktop/mobile interactions passed. Light/dark desktop/mobile screenshots were inspected; minimum widget-border versus action-card contrast was 4.30:1 light and 5.10:1 dark, with sampled widget title contrast above 15:1. No overflow, product actions or backend changes. Nothing pushed or published.
