# Discover Strong Consider score layout

- Hide the reasoning excerpt on compact Strong Consider cards so the saved job-match scores have room. Keep the priority tag and full analysis in the job preview.
- The detached demo uses the same RoleCard presentation, including Strong Consider examples; no services or MCP contracts change.
- Validation: frontend typecheck, catalog validation and production build passed. Built detached demo checked at 1280px and 390px: all three Strong Consider cards hide the excerpt without horizontal overflow.
- Limits: presentation-only change; no real account data or hosted deployment changed.

## Follow-up: seven facts on the card

- Replace compact facts, reasoning excerpts and four match scores with the seven labeled job facts directly on every Discover card: compensation, location, work setting, focus, sponsorship, posted date and availability check. Values come from each saved role; nothing is hardcoded from the example.
- The full job drawer retains its analysis. Demo cards share the same component; no backend or MCP changes.
- Validation: frontend typecheck, data validation, production build and desktop/mobile detached demo checks.

## Follow-up: four card facts

- Remove Sponsorship, Posted and Availability checked from Discover cards. Keep Compensation, Location, Work setting and Focus. Full job-preview facts remain available; demo cards use the same presentation.
- Validation: frontend typecheck, data validation and production build.

## Follow-up: two card facts

- Keep only Compensation and Location on Discover cards, with visible labels. The full job preview retains all facts. Demo cards share the same presentation.
- Validation: frontend typecheck and catalog validation.
