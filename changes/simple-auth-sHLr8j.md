# Simple login and sign-up

- Added /login/ and /signup/ with the existing Google account flow, pending/error states, privacy and account-switch links. Signed-out Discover uses the same login page.
- Landing-page account links now open dedicated routes. Returning users go to Discover; new accounts continue onboarding. Auth entry exits remembered demo mode.
- Demo coverage: /login/?demo=1 and /signup/?demo=1 preview fictional auth states without calling auth or creating accounts.
- MCP boundary unchanged: authentication remains a human Google OAuth action; existing scoped tools require the resulting identity. No new backend capability or approval behavior.
- Validation: data validation (158 roles), production static build, 15 focused auth/demo/search tests, and headless Chrome route/link/demo-interaction checks at desktop and 390px mobile widths passed. After integrating current local main, all 838 tests and the production build passed; the earlier demo-search fixture failure is resolved by that integration. Desktop/mobile screenshots reviewed against existing theme tokens and Google button.
- Limits: no real Google account created or signed in during verification.
