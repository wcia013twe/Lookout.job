# Restore job preview

- Replace Open Application on Discover cards with Preview Job, opening the existing right sidebar. Keep the employer link inside the preview and AI Apply unchanged. Shared cards cover the detached demo and onboarding saved role.
- No new backend action: preview remains local read-only UI; existing scoped application tools are unchanged.
- Validation: data validation (158 roles), frontend typecheck, UI detector, and desktop/mobile detached-demo interaction check passed (open, employer link, viewport bounds, Escape and focus return).
- Full test suite: 829/830 passed; existing search-context fixture expects partial but receives completed. Full output: /private/tmp/job-preview-tests.log. No production services or submissions tested.
