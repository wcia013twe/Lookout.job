# texture-picker

<!-- change-fragment: complete -->

- Added an accessible pack-texture selector with the original foil and five named holographic choices. Selections update the existing `preferences.theme.pack` value, persist in browser/account state, and remain isolated in demo mode.
- Added reduced portrait derivatives of the supplied Indieground freebie assets, their license note, and static-export preparation. The high-resolution source files are not shipped.
- Kept website/MCP parity through `save_theme_preferences`, documented the supported pack values, and incremented the agent developer contract to version 16.
- Demo coverage: the fictional daily pack exposes every texture while its memory-only theme selection resets to `base` and never reaches account storage.
- Validation: focused pack/cloud/demo/MCP tests (30 passed); `npm run typecheck`; `npm run validate:data` (76 roles); static `npm run build` (10 routes, 107 offline assets); Impeccable detector (no findings); desktop/mobile, light/dark, keyboard, scrolling, persistence, and browser-console verification.
- Limit: the full Windows `npm test` run passed 287 of 288 tests; the unrelated `platform-outreach` test compares LF guide text with a CRLF checkout file and fails only on newline representation. No production backend deployment was performed from this feature branch.
