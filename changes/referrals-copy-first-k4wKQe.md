# Referrals copy-first UX

- Replaced the Contact & fit details accordion with a read-only Relate / Value / Ask breakdown. Saved contact metadata remains intact and available to the existing outreach service and agent tools.
- Kept the editable message and Copy message as the primary workflow; removed the format selector and local details-based regeneration. Existing email subjects stay editable/copyable. Manual addition accepts a pasted message without a contact-type selector.
- Demo outreach requests now create clearly fictional alumni/referral drafts with backend context. Existing demo contacts cover recruiter next steps and team introductions.
- MCP mapping: existing outreach contact save/update boundaries remain unchanged; this is presentation over existing records. No new service or tool.
- Validation: all 341 tests passed, data validation (76 roles), frontend typecheck and static production build passed; mechanical UI detector reported no findings. Browser checked manual creation, rendered breakdown, copy success, and desktop/mobile layouts.
- Demo check: request outreach for a fictional company, inspect the three context lines, edit its ask and copy; switch contacts, check manual addition and reset. No real outreach is sent.
- Limits: authenticated cloud persistence and admin-only demo request interaction were not exercised in the browser. Existing save contracts and account boundaries are unchanged.

## Sentence highlights

- Replaced the separate breakdown with highlighted complete sentences and leading arrow labels for Relate, Value and Ask. Greetings, signatures and unclassified sentences stay plain. Matching uses saved connection/evidence and recognizable sentence patterns; it does not infer missing facts.
- Read view uses React text/mark wrappers. Edit message opens the original textarea; copying and persistence keep the original plain text and whitespace. The existing fictional alumni draft exercises all three annotation types.
- Validation: 341 tests, data validation, frontend typecheck and static build passed. Sentence tests cover exact text reconstruction, full-sentence classification, unmatched/empty content and saved evidence. Browser checked desktop/mobile wrapping, editing and plain-text copying.
- Limits: sentence labels use deterministic matching, so unfamiliar wording can remain unhighlighted. Authenticated cloud saves were not exercised.
