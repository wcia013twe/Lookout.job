# Muse account organization

- Developer contract 45 maps account organization to existing scoped tools, requires owned read-back, preserves user state and reports partial/uncertain API failures safely.
- Added an immediately usable Muse prompt and documented hosted data versus agent/runner responsibilities.
- Validation: validate:data passed (147 roles). Full npm test failed in the database suite with a PGlite WASM null function/signature mismatch; complete output retained at /private/tmp/muse-account-tests.log. Focused application-mode/context-version tests passed.
- Limits: no authenticated production account or hosted deployment verified; no account writes or external submissions performed. Prompt-only change: demo remains fictional and isolated; no new demo interaction or tool boundary.
