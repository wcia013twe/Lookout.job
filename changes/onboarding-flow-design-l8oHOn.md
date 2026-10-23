# First-application onboarding design

- Added a self-contained clickable design under .lavish/onboarding-first-application.html, using the existing Lookout typography, setup palette and card-reveal visual language.
- Flow starts after the existing agent connection: minimal search direction, a single first-role reveal, preparation using existing context, asynchronous connected-app review request, explicit revision-bound approval and confirmed receipt.
- Includes recommendation-only, missing-resume, missing-answer, no-match/refinement, unavailable-notification and uncertain-submission branches. Fictional data and local simulation only; no real service, account, notification or employer calls.
- Documents reuse of RevealCard, AgentConnections, AgentFirstSetup and scoped contracts. Current reveal remains untouched; extraction and one-gesture onboarding behavior are proposed implementation work.
- Validation: JavaScript syntax check, catalog validation and git diff --check; browser-checked reveal interaction, disabled approval until review acknowledgment, pending confirmation after approval, desktop layout and 390px message reflow without horizontal overflow.
- Mechanical design detector flagged typography/palette advisories and the existing Inter font; the prototype intentionally follows the app's current setup and card styling.
- Limits: design prototype only. Production React, backend and demo fixtures are unchanged; the prototype supplies isolated fictional coverage. Live notification/submission integrations are not implemented or verified. No production build needed for the standalone design.
