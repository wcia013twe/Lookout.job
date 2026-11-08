# Discover Strong Consider tag

- Refined the existing Strong Consider assessment tag with a soft violet surface, matching outline, small accent dot, round shape and more balanced spacing. Its text stays on one line in full and compact role widgets. On full Discover cards it sits beneath the company name so long titles retain their width. Saved priority and custom fit labels are unchanged.
- Existing fictional Discover previews cover Strong Consider alongside a custom Strong fit label. The UI check now verifies the priority tag on desktop/mobile and captures both themes.
- Validation: assessment rendering tests (2 passed), frontend typecheck, catalog validation (158 roles), design detector (no findings). Production export and desktop/mobile UI verification recorded after completion below.
- Limits: presentation-only change using existing saved-label reads; no backend/tool behavior changed. Real-account/hosted deployment not exercised.
- Final verification: production static export passed; desktop/light and mobile/dark UI checks passed (single-line tag, no overflow, match expansion, keyboard preview and queue action). Visually inspected tag crops and the full desktop Discover layout at /private/tmp/discover-priority-tag-ui.
