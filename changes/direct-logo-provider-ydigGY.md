# Direct Logo.dev rendering

- Removed the separate logo manifest/storage fallback and the special Google company-logo override from the shared renderer. Company/school marks now use Logo.dev, then a briefcase on missing configuration or image failure. Google sign-in retains its official button asset.
- Simplified image-failure state and preserved recovery when the organization changes. Updated current documentation; legacy storage/assets/utilities are not deleted or consulted by the renderer.
- Extended the existing fictional browser check to assert that Google uses Logo.dev and no legacy logo storage requests occur.
- Validation: frontend typecheck and production build passed; npm test passed 957 tests (5 skipped); catalog validation passed for 158 roles; focused logo/demo tests passed. Browser checks passed direct loading, missing-image fallback, name-change recovery, project-icon preservation, demo reset, and desktop/mobile layout without account writes or legacy cache requests. Screenshots inspected; mechanical design detector returned no findings.
- No backend/schema changes, live account edits, push or hosted deployment.
