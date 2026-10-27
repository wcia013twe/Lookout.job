# Optional first role after AI connection

- Website onboarding now saves preferences and proceeds to AI connection. Confirmed connection opens an optional first-role preview offer with Skip for now; skipping connection proceeds directly to Circles.
- Catalog selection runs only when the user chooses the preview. Continuing from the reveal proceeds with setup instead of returning to connection. Connected-state copy avoids asking the user to connect again.
- Existing scoped connection-read and search-profile save boundaries remain unchanged. Preview does not start discovery tasks, prepare applications or grant approval. Shared components retain fictional demo isolation.
- Validation: frontend typecheck, 11 onboarding/handoff tests, data validation (158 roles), production build, clean design detector and mocked browser walkthrough of saved preferences → connection confirmation → optional offer → skip → Circles passed. Existing desktop/mobile resume and role/location interactions passed in the same check.
- Limits: connection browser check uses a fictional runtime receipt; no live agent search, provider deployment or publication.

## Remove opening Simplify import

- Removed the Simplify import handoff from the opening onboarding page and its unused wrapper/imports. Other Simplify entry points remain available. Shared onboarding/demo rendering uses the updated page. No backend or MCP behavior changed.
- Validation: frontend typecheck, data validation (158 roles), and whitespace checks passed. Removal-only UI change; no new runtime behavior.
