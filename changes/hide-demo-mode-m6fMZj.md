# Hide Demo mode in the profile menu

- Removed the Demo mode entry from regular signed-out and signed-in profile menus. Existing fictional demo sessions retain Exit demo mode and reset controls so users can leave/reset a preview.
- Extended the profile-access browser check with assertions that regular menus have no demo entry and active demo menus retain their exit. No backend, fixture data, or MCP behavior changed.
- Validation: TypeScript typecheck, data validation, and browser access/menu checks for guest, signed-in, anonymous and detached-demo sessions passed. Updated the localhost preview and refreshed Chrome. No new unit tests for the presentation-only visibility change.
- Limits: direct demo URLs and separate fictional preview surfaces are unchanged. Nothing pushed or published.
