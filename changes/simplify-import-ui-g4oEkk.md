# simplify-import-ui

## Simplify import UI refinement

- Reworked the Simplify import disclosure into a compact, accessible summary row and replaced the raw browser file-input presentation with a clear CSV picker while preserving the import flow and privacy/status guidance.
- Validation: `npm run build`, `npm run validate:data`, and the Impeccable detector on both changed import UI files passed.
- Limits: Visual browser capture was unavailable because the temporary local development server could not remain reachable from the browser-automation environment; production compilation and static export succeeded.
