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

## Editable highlighted text box

- Replaced the read/edit toggle and arrow gutter with one custom text box. A decorative, inaccessible highlight layer follows the native controlled textarea, preserving native cursor selection, undo, composition and plain-text editing. Highlight sentences open short Relate / Value / Ask notes on click/tap or keyboard cursor navigation.
- Notes are hidden initially, appear alongside the editor on wide screens and below it on mobile, and close with Escape or their close button. Edits clear the active note. The editor grows with its contents and remeasures when its width changes; both layers share exact typography and wrapping.
- Shared-employer wording from the user's example is recognized as Relate. No external profile claims or new stored fields are introduced; existing save and MCP boundaries are unchanged.
- Demo check: prepare the fictional alumni message, click each highlighted sentence, type directly, use arrow keys and Escape, copy, and reset. Existing demo drafts cover all three annotation types.
- Validation: 342 tests, data validation (76 roles), typecheck, static production build and UI detector passed. Browser verified desktop/mobile note placement, highlight alignment, keyboard navigation/dismissal, direct editing and plain-text copy.
- Limits: unfamiliar phrasing can remain unhighlighted; notes are concise guidance based on sentence categories. Authenticated cloud saves were not exercised.

## Persistent note panel and category colors

- Keep both the editable message box and sentence-note panel visible. The empty note panel prompts the user to click a highlighted sentence; dismissal restores that prompt. Desktop editor width stays fixed as notes change, and the note panel stays below the editor on mobile.
- Added distinct Relate (yellow), Value (blue), and Ask (green) highlights, a small labeled key, and matching selected-note swatches. Active highlights retain their own color with stronger emphasis. Existing message values, editing and storage contracts are unchanged.
- Validation: 342 tests, data validation, frontend typecheck and static build passed. UI detector reported no findings for the category-color change. Browser checked desktop/mobile colors, persisted message content, the empty note panel, and selecting/dismissing a note without resizing the editor.
- Demo check: existing fictional message contains all three highlight categories; inspect the persistent placeholder, select a sentence, close its note, and reset.
- Limits: authenticated cloud saves were not exercised; category matching retains its existing deterministic behavior.
