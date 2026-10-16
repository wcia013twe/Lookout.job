# Referrals copy-first UX

- Replaced the Contact & fit details accordion with a read-only Relate / Value / Ask breakdown. Saved contact metadata remains intact and available to the existing outreach service and agent tools.
- Kept the editable message and Copy message as the primary workflow; removed the format selector and local details-based regeneration. Existing email subjects stay editable/copyable. Manual addition accepts a pasted message without a contact-type selector.
- Demo outreach requests now create clearly fictional alumni/referral drafts with backend context. Existing demo contacts cover recruiter next steps and team introductions.
- MCP mapping: existing outreach contact save/update boundaries remain unchanged; this is presentation over existing records. No new service or tool.
- Validation: all 341 tests passed, data validation (76 roles), frontend typecheck and static production build passed; mechanical UI detector reported no findings. Browser checked manual creation, rendered breakdown, copy success, and desktop/mobile layouts.
- Demo check: request outreach for a fictional company, inspect the three context lines, edit its ask and copy; switch contacts, check manual addition and reset. No real outreach is sent.
- Limits: authenticated cloud persistence and admin-only demo request interaction were not exercised in the browser. Existing save contracts and account boundaries are unchanged.
