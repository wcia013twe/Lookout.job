# Simple login and sign-up

- Added /login/ and /signup/ with the existing Google account flow, pending/error states, privacy and account-switch links. Signed-out Discover uses the same login page.
- Landing-page account links now open dedicated routes. Returning users go to Discover; new accounts continue onboarding. Auth entry exits remembered demo mode.
- Demo coverage: /login/?demo=1 and /signup/?demo=1 preview fictional auth states without calling auth or creating accounts.
- MCP boundary unchanged: authentication remains a human Google OAuth action; existing scoped tools require the resulting identity. No new backend capability or approval behavior.
- Validation: data validation (158 roles), production static build, 8 focused auth/demo routing tests, and headless Chrome route/link/demo-interaction checks at desktop and 390px mobile widths passed. Full suite: 831/832 passed at feature base; unchanged search-context demo fixture expected partial but received completed. Desktop/mobile screenshots reviewed against existing theme tokens and Google button.
- Limits: no real Google account created or signed in during verification.
