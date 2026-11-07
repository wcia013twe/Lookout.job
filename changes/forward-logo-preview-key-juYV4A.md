# Forward Logo.dev configuration into live preview

- The live-main/local frontend environment whitelist now forwards the configured publishable Logo.dev key from the source checkout. The live clone intentionally has no private env files.
- Added source/Next env precedence, trimming, local/hosted parity and secret-key rejection coverage. Documented restarting the launcher after configuration changes.
- Validation: all 5 focused live-preview tests and 158-role catalog validation passed. Full suite and actual live-preview verification in progress. No frontend component, backend or account data changes.
