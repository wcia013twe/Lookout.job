# Networking person cards

- Replaced Network subtabs and company request forms with contextual Muse suggestions and searchable person cards. Added optional company filtering, person deep links, relationship updates, and preserved annotated drafts with collapsed message/meeting history.
- Kept the existing contact store, IDs, company workspaces, application links, pending requests and revision checks. Added validated person context and suggestions to browser/full/partial Muse writes, including people without a company. Legacy process/company links remain usable. Forms retain their opening revision to reject stale writes.
- Updated Muse’s cold-outreach guide and developer discovery guidance for useful discovery, maintenance and referral suggestions during existing authorized work. No scheduler, inbox integration or sending capability was added.
- Validation: repository suite (932 tests), frontend typecheck, production static build, data validation (158 roles), person-context SQL/contract tests, and isolated dark-desktop/light-mobile browser checks. Browser scenarios cover copy/status separation, preserved history/drafts, relationship updates, dismissal, company/process links, no-company creation, search, demo reset and overflow. Only public logo requests were blocked; no private account traffic occurred.
- Limits: hosted migration/gateway/MCP deployment and live Muse execution were not performed. Existing legacy identities are retained without automatic merges. No real outreach was sent.

## Visual follow-up

- Reused Applications’ company-logo component, identity sizing, rounded card treatment, and shared line icons across suggestions, people, and detail. Added labeled action icons, suggestion-purpose badges, follow-up markers, and a search icon; people without a company use a neutral person icon.
- Kept message/history behavior and all contact data contracts intact. Extended only the shared icon catalog and scoped Network styling. Browser checks allow public cached logo assets while blocking private account traffic.
- Validation: frontend typecheck, production static build, 22 focused Network/outreach tests, data validation (158 roles), and dark-desktop/light-mobile UI checks with no overflow. No push or deployment.
