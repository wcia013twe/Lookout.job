# Discover posting age and availability

Added Posted filters for 24 hours, 3 days, one week, two weeks, one month, any time and unknown publication dates. Publication age is independent of employer-check recency. Any time preserves the initial board. The preview separates readable Posted and Availability checked facts; cards and previews include a small status icon and Live/Closed/Unverified label grounded in recorded observations. Live describes the last check. The duplicated raw posted date was removed from About the job.

Shared pure presentation rules live in lib/posting-age.mjs. Existing scoped batches.read gateway/MCP evidence is unchanged; these local view controls add no service or write operation. No schema, catalog or private account data changed.

Demo coverage includes recent, older and unknown publication dates with active, expired and uncertain observations, isolated in fictional memory fixtures. Browser checks exercised posting filters and the opened preview at 1440px and 390px, checked unknown/reset behavior, and found no horizontal overflow or page errors.

Validation: npm test (767 passing, including database scenarios); npm run validate:data (158 roles); frontend typecheck; production build; focused demo/filter tests after local-midnight fixture and accessible-label corrections (24 passing); final production rebuild; git diff --check; UI detector (no findings). Verification used the local static export and fictional demo; hosted deployment and fresh employer liveness requests were not performed.

## Follow-up: concise job facts

Replaced narrative work-setting and sponsorship paragraphs with predictable display categories. Unknown compensation, location and focus use Not disclosed. Work authorization is never interpreted as a sponsorship policy, and location is never interpreted as an office requirement. The original stored evidence and existing scoped backend/MCP responses are unchanged; this is presentation formatting only, with no new service action. Demo fixtures cover available, unavailable and undisclosed sponsorship. No expansion controls were added.

Follow-up validation: npm test (809 passing, including all database scenarios), 24 focused fact-label/demo/profile tests, npm run validate:data (158 roles), production build including TypeScript, git diff --check, and UI detector (no findings). Desktop (1440px) and mobile (390px) browser checks verified concise known/unknown labels, no extra expansion controls, no horizontal overflow and no page errors. Original evidence and hosted services were not modified. Temporary preview server used only the local static export and fictional demo fixtures.
