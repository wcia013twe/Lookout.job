# Theme picker

Profile navigation → Theme opens a two-column grid: None, System, Light, Dark. The desktop header uses the same control. None replaces workspace colors with neutral tokens and removes remaining chroma from component colors and artwork. Fonts, layout, interaction states and controls remain styled. System follows the device; None stays neutral regardless of device appearance.

The selection is a browser-local presentation preference (`lookout.color-mode`), applied before first paint and shared between controls and browser tabs. It does not change account theme/pack preferences or job data.

Agent boundary: this browser-local preference is a human action. Direct the user to Profile → Theme → None; do not claim that `save_theme_preferences` changes the browser appearance. That scoped MCP tool continues to manage account theme/pack preferences only. No remote appearance control or deployed MCP parity is advertised.

## Demo interactions

Use the existing fictional admin demo profile and open Profile → Theme. Select None, then Light/Dark/System to compare the same fictional roles and statuses. Theme selection in demo does not write browser storage or backend preferences; exiting demo restores the saved browser preference. Existing fictional catalog/profile fixtures are reused, so no real account data or external submissions are involved.

Verify keyboard disclosure and radio navigation, header/profile synchronization, first-paint persistence, and desktop/mobile grid layout. Unit tests cover parsing, device resolution, first paint and unavailable storage.
