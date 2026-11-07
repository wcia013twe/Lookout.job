# Employment information questions

- Replace the Application answers editor fields with the nine exact employment-information questions: ethnicity, three country work authorizations, visa sponsorship, disability, LGBTQ+ identity, gender and veteran status. Unknown values stay blank; personal answers are never shared defaults.
- Match explicit answers through the existing versioned profile and draft-prefill paths. Preserve legacy sponsorship values and reject conflicts. Keep employer option matching exact and submission review unchanged.
- Update the isolated fictional demo, profile-tool documentation and generated search-document bundle.
- Validation: focused application/profile/search-document tests (29 passed), frontend typecheck, static production build, data validation (158 roles), and full test suite (945 passed, 5 skipped, 0 failed).
- Limits: no live account answers changed and no hosted deployment or employer submission performed.
