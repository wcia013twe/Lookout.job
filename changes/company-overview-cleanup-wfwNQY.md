# Company overview cleanup

- Replaced five equally weighted sections and a sidebar with a compact company summary, target team and next step. Personal notes and research evidence expand on demand; empty fields and permanent reminder instructions no longer clutter the overview.
- Kept the existing company editor, contact/application tabs and scoped list_contacts/save_contact service contracts. Archived reminders are labeled paused.
- Demo coverage: Cedar has full notes/evidence; Northstar now has no personal notes or sources, exercising sparse disclosure behavior; Archived Example covers paused reminders.
- Validation: all 416 tests passed on Node 25 (including database and existing scoped Network/MCP checks); validate:data passed for 76 roles; frontend typecheck and static production build passed. Mechanical UI detector returned no findings. Browser demo checks confirmed populated and sparse views, expanding notes/sources, disclosure reset between companies and archived reminder wording.
- Limits: visual inspection used the available 716px light-mode browser viewport; dedicated phone/wide/dark captures and real account write round trips were not run. No production deployment. Node 22 test failures were TypeScript-loader incompatibilities; complete logs are in /tmp/company-overview-tests.log and /tmp/company-overview-tests-node25.log.
