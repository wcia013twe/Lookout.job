# Workspace startup recovery

- Bound session initialization and website setup reads to 12 seconds, showing a retryable error if either stalls instead of an indefinite loading screen. Local test sign-in is bounded too; access still requires an authenticated session and completed setup.
- Validation: startup timeout, workspace access, cloud sync and demo tests; frontend typecheck and production build; catalog validation.
- Limits: the frontend and local Auth health endpoints responded and a clean browser loaded the landing page. The existing browser session's underlying hang was not reproduced or identified; Google OAuth and an authenticated round trip were not verified.
