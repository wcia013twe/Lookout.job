# Industry bubbles

- Replaced the Industries text input with the supplied 31-choice taxonomy, accessible multi-select bubbles, and selected chips in reading mode. Existing custom values stay selectable. Priority, unrelated fields, autosave, undo and owner/version checks remain separate and unchanged.
- Website and native MCP continue using the existing Company preferences / Industries labeled string and save_search_profile boundary, with no new API or database fields.
- Demo fixtures cover selected canonical and custom industries. Added domain/MCP regression tests and an isolated browser interaction check.
- Validation after integrating current local main: full suite 957 tests, 952 passed, 0 failed, 5 skipped; frontend typecheck; production static build (425 offline assets); 158 catalog roles validated. Industry UI check passed exact labels, standard/custom toggles, Space/Enter, rapid edits, autosave/remount, undo after save, finish/reopen, duplicate recovery, clearing, busy state, demo reset, desktop dark/mobile light, 44px targets, no overflow and no cloud writes. Initial test/build attempts hit a full system temp volume; SSD-temp reruns succeeded.
- Limits: local feature only; no hosted deployment or real account changes. Existing sections have Finish editing, not discard/Cancel.
