# End-to-end onboarding design

- Replaced the earlier flow with two short setup screens: optional LinkedIn reference or résumé upload, then work type/job type/location. First value comes from an existing catalog role with a single card reveal; it does not imply an unconnected agent researched or matched the user's experience.
- Added the existing Zoom-style agent room and agent artwork at application preparation. Connection remains waiting until an explicit prototype control simulates authenticated runtime verification. Notification capability is simulated separately; the test-message acknowledgment is user-reported.
- Added local file selection/drop with PDF/DOCX and 10 MB validation, LinkedIn URL validation, country-specific authorization and separate sponsorship-now/future answers, exact-material approval, pending/uncertain outcomes, confirmed receipt, and an optional Circles invitation.
- Rebuilt the isolated prototype in React and Framer Motion with reduced-motion support. Retained dashboard dark surfaces, rainbow hues and dots; trimmed product copy.
- Files: .lavish/onboarding-flow.tsx and .css are editable sources; onboarding-preview.js is the local production-mode bundle; onboarding-first-application.html is the Lavish entry; onboarding-assets contains small derivatives of existing agent artwork.
- Validation: esbuild production bundle; node syntax check; catalog validation (147 roles); git diff --check. Browser walkthrough covered LinkedIn URL → preferences, résumé fixture → reveal → connector waiting/verified → separate messaging-ready/test/acknowledgment → eligibility → preparation → review → receipt. Verified country changes clear answers, incomplete eligibility blocks approval, and explicit approval checkbox gates submission. Mobile entry and Zoom room fit a 390px viewport without horizontal overflow.
- Demo: isolated local fictional data only. Files are selected locally but not parsed/uploaded; LinkedIn is not imported; no live messages, connections, applications or Circle memberships are created. Production UI/backend/demo fixtures remain unchanged.
- Limits: the complete secure sign-in/token/permissions form remains an implementation seam for reusing AgentConnections, not a live connector in this prototype. Production notification/submission paths and LinkedIn import are not implemented or verified. No production app build or database tests needed for this design-only change.
- Rebuild after normal dependency installation: NODE_PATH=./next-app/node_modules npx esbuild .lavish/onboarding-flow.tsx --bundle --jsx=automatic --minify --define:process.env.NODE_ENV='"production"' --outfile=.lavish/onboarding-preview.js


## Gold-card follow-up
- Matched Discover’s legendary gold banner, faceted surface and dark card body. The same card opens, moves left and reveals the analysis; fit bars fill before the text types. Reduced motion shows the result immediately.
- Replaced work and location text fields with accessible radio pills plus custom entries. Removed the alternate-role and duplicate exploration actions; kept the primary action and one “I’ll do this later.”
- Validation: rebuilt React bundle, node syntax check, data validation and diff check. Browser verified selected work/location appear on the card and the continuous reveal reaches the analysis. Desktop inspected; mobile card/analysis stack fits a 390px viewport without horizontal overflow.
- Live résumé/search request remains pending runtime choice and résumé input. Existing upload still selects a filename only. Fit bars, role and analysis remain explicitly illustrative; no live-search integration or inference was claimed or enabled.


## Editable preference suggestions
- Work and location now always show a text input, with suggestion pills below. Choosing a suggestion fills the input; users can edit it directly without selecting Other. The same value flows through the reveal and later screens.
- Verified in the browser: selected Design/Remote, typed Product designer/Boston or remote, and confirmed both custom values on the revealed card. Bundle syntax, data validation and diff checks passed.


## Circle story and two-sided card
- Added an optional animated Circle message chain: a member shares an interview question, the agent identifies a practice opportunity, proposes a time, the fictional user agrees, and a clearly marked demo mock-interview booking appears. The supplied Better with company / Find your Circle invitation follows and opens the existing join/create preview.
- Kept the dashboard theme, compact scrollable conversation, attribution to the shared tip, and immediate reduced-motion presentation. Messages, booking and membership remain isolated fictional state; no messaging or calendar integration was invoked.
- Replaced the sealed gold face with the requested purple card back and a white four-point star. Tap or horizontal swipe rotates the two-sided card to the gold Discover front, then moves it left for animated fit bars and typed analysis. The hidden face is excluded from accessibility navigation.
- Validation: esbuild, node syntax, catalog validation (147 roles), diff check. Browser inspected purple back and settled gold front; verified the Circle chain and booking completion, the invitation-to-join navigation, and the 390px mobile story with no horizontal overflow. Swipe handler and reduced-motion branch inspected in source; device swipe and OS reduced-motion setting were not separately exercised.
