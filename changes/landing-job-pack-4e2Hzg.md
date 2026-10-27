# Lookout public landing

- Added the approved four-section signed-out landing: tutorial role card, Muse check-in, interview preparation and Circles. Copy stays brief and sample content is explicitly illustrative. Signed-in home and explicit demo preserve Discover.
- Extracted the existing onboarding gold card into a shared TutorialRoleCard; landing Pass/Review is local-only and never submits or saves preference feedback. Existing Google account onboarding and protected Discover own signup/login.
- Delegated the mascot to a subagent: existing Lookout art, stationary body, subtle pupil movement and brief blinks. Pause and reduced-motion modes are available. Reused brand, company logo, button and icon components, plus the existing theme tokens. Google uses the bundled logo.
- Validation: frontend typecheck and static production build passed; data validation passed (158 roles). Desktop/mobile landing interactions and signed-out/account/demo boundary browser checks passed using fictional intercepted sessions. Full suite: 824/825 passed; existing dashboard-tour test expects Circles while committed navigation says Community. That unrelated mismatch was preserved.
- Limits: no real Google OAuth round-trip, hosted agent scheduling or production backend capability was claimed or tested. No backend/MCP mutation added. Nothing pushed or deployed.
