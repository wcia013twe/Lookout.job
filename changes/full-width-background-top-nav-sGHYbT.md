# Full-width workspace background and top navigation

- Extended the themed workspace background across the viewport while keeping header and content in one centered max-width container with consistent responsive horizontal padding and safe-area insets.
- Moved navigation into the top header, centered between brand and account controls on desktop. Mobile navigation now appears below the brand at the top; removed the fixed bottom bar and its reserved page padding. Existing routes, badges, selected-tab motion, and profile controls remain available.
- The shared shell also renders the existing fictional demo pages; demo interactions and isolation remain covered by the existing fixtures. No backend action or MCP contract changed.
- Validation: frontend typecheck, production static build, data validation (76 roles), and 21 theme/demo tests passed. git diff --check passed. Design detector reported only the pre-existing Inter font choice, preserved for consistency.
- Limits: no browser visual inspection; frontend checks used a copy of the local app’s installed dependencies.
