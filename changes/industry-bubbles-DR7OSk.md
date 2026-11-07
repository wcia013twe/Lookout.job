# Industry bubbles

- Replaced the Industries text input with the supplied 31-choice taxonomy, accessible multi-select bubbles, and selected chips in reading mode. Existing custom values stay selectable. Priority, unrelated fields, autosave, undo and owner/version checks remain separate and unchanged.
- Website and native MCP continue using the existing Company preferences / Industries labeled string and save_search_profile boundary, with no new API or database fields.
- Demo fixtures cover selected canonical and custom industries. Added domain/MCP regression tests and an isolated browser interaction check.
- Validation before main integration: full suite 954 tests, 949 passed, 0 failed, 5 skipped; frontend typecheck; production static build; 158 catalog roles validated. Browser validation in progress. Initial test/build attempts hit a full system temp volume; SSD-temp reruns succeeded.
- Limits: local feature only; no hosted deployment or real account changes. Existing sections have Finish editing, not discard/Cancel.
