# Forward Logo.dev configuration into live preview

- The live-main/local frontend environment whitelist now forwards the configured publishable Logo.dev key from the source checkout. The live clone intentionally has no private env files.
- Added source/Next env precedence, trimming, local/hosted parity and secret-key rejection coverage. Documented restarting the launcher after configuration changes.
- Validation: all 5 focused live-preview tests and 158-role catalog validation passed. The full suite encountered isolated-checkout dependency-link failures; after restoring the links, all 61 tests in the affected files passed.
- Restarted the actual port-3000 live preview using its saved local backend URL/public key while service discovery was stalled. A clean browser confirmed 3 loaded Logo.dev images and HTTP 200 responses for Google and Meta. The live-main watcher remains active; no backend or account data changed.
- No push or hosted deployment.
