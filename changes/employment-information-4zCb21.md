# Employment information questions

- Replace the Application answers editor fields with the nine exact employment-information questions: ethnicity, three country work authorizations, visa sponsorship, disability, LGBTQ+ identity, gender and veteran status. Unknown values stay blank; personal answers are never shared defaults.
- Match explicit answers through the existing versioned profile and draft-prefill paths. Preserve legacy sponsorship values and reject conflicts. Keep employer option matching exact and submission review unchanged.
- Update the isolated fictional demo, profile-tool documentation and generated search-document bundle.
- Validation: focused application/profile/search-document tests (29 passed), frontend typecheck, static production build, data validation (158 roles), and full test suite (945 passed, 5 skipped, 0 failed).
- Limits: no live account answers changed and no hosted deployment or employer submission performed.


## Security clearance preference

- Add Job preferences → Eligibility with the exact top security clearance question, supplied explanation and Yes / No / No preference selector. Blank defaults to No preference. Remove the old free-text field from Skills & compensation while preserving saved prose in Advanced instructions.
- Save through existing owned, versioned profile tools; validate choices and keep clearance preference separate from application facts. Add fictional Yes/No demo states.
- Validation: focused profile/application/search tests (30 passed), frontend typecheck and Impeccable detector (no findings). Static production build passed on retry after freeing task-owned npm cache. Full suite: 940 passed, 5 skipped, 6 failed only from ENOSPC; all affected files passed on rerun (14 tests). Headless Chrome verified exact options, editing/clearing round trips and desktop/mobile layout; screenshots visually inspected. Catalog validation passed (158 roles).
- Limits: no deployment, no actual clearance assertion, and no new deterministic catalog filter. Search agents use the saved profile instructions.
