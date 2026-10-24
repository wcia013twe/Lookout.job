# Lookout logo

- Unified workspace, signed-out, onboarding and connection-preview branding with a lavender lookout-eye mark on charcoal, matching the existing palette in both themes.
- Renamed the installed app to Lookout; added 192/512px app PNGs, a full-background maskable icon and a 180px Apple touch icon. Asset URLs preserve static-export base paths.
- Demo coverage: detached demo inherits the shared mark; inspected its header at phone and desktop viewport sizes. No fictional data or account interactions changed.
- Validation: data validation (158 roles), frontend typecheck, production build (55 pages), clean design detector, and git diff check. Full npm test suite: 563 passed, zero failed.
- Limits: actual iOS/Android installation and existing installed-app icon cache refresh were not tested. No service actions or MCP contracts changed.
