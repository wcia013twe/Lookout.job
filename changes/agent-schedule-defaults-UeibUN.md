# Restore My Agent defaults and compact help

- Restored the four unsaved daily defaults in the browser time zone when no schedule exists. Saved empty schedules remain empty and offer an explicit Use default schedule action; custom timings, pauses and task assignments are preserved. Set the search opens by default so tasks are visible.
- Added accessible info buttons for task, source, update and discovery explanations. Native popovers support pointer/keyboard use, Escape/outside dismissal, viewport-safe placement and scroll/resize tracking. Keep task instructions and actionable empty states visible.
- Defaults remain unsaved until Save tasks and saving does not activate an agent scheduler. Both restore/save reuse the existing versioned preferences.notifications.save boundary, already exposed through the scoped preferences MCP tool; no backend or gateway instruction change.
- Demo coverage: detached missing/empty/custom schedule scenarios verify defaults and exact times, save to demo memory only, saved-state preservation, keyboard popovers and desktop dark/mobile light overflow. Inspected both layout captures. No account writes or real scheduling occurred.
- Checks: npm test (520 passed, including three new schedule regression cases and database scenarios), data validation (147 roles), production export build/typecheck, Impeccable detector (no findings), and all three browser scenarios passed.
- Limits: save behavior was exercised in the isolated demo, not a real account. No push, deployment or running automation created.
