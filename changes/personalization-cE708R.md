# Personalization follows About me

- Renamed Application kit to Personalization in profile navigation, overview shortcuts, accessible labels and current documentation.
- Reused About me’s bordered sections, two-column values and scoped pencil/checkmark editing for materials, employer-question style, outreach style and the account-wide resume default. Shared resume and employer-answer libraries remain expanded in matching sections; existing creation, review and reuse controls remain available.
- Per-profile material/style changes still use Save application profile. The account-wide PDF default still saves automatically; finishing section editing does not save a profile. Style preview describes current draft guidance honestly.
- Demo fixtures show selected full-time materials and unset internship choices. The profile UI check exercises read/edit/preview, unsaved section switching, save/reload, separate profiles, demo reset, desktop dark/mobile light layouts and cloud isolation.
- MCP mapping: existing `save_search_profile` / `preferences.profile.save` for profile selections and writing fields; resume/answer actions and account-wide preferences keep their existing scoped contracts. No service, payload, permission or backend validation changes.
- Validation: npm test (425 passed), npm run validate:data (147 roles), frontend typecheck, production static build, profile UI integration check against both dev and built static output, git diff --check; Impeccable detector reported no findings.
- Finish review: ship, with no material findings. Documentation matches the implemented UI; existing shared design tokens and components are preserved.
- Verification limits: local fictional demo with intercepted cloud traffic; no production deployment, real private-file upload/download, external message, submission or hosted MCP verification in this presentation-only pass.

- Local landing integration: preserved concurrent About me section-save behavior, removed footer/authorization notes and entry icons, plus My agent daily schedule and other main updates. Resolved shared README and profile-check conflicts; Personalization keeps its existing explicit profile save while About me saves from its section checkmarks.
- Integration verification: all 425 tests, data validation, production export and the complete profile browser check passed after conflict resolution. The first integration build hit a transient host ENOSPC error; retry passed. Source-only integration review confirmed the ship verdict and resolved tooltip minor.
- A second concurrent-main integration preserved custom daily tasks, Profile section deep links and Circle agent settings; both sets of demo checks are retained.
