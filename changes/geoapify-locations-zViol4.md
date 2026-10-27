# Geoapify country and city selection

- Replaced fixed onboarding location suggestions with debounced Geoapify country/city autocomplete, keyboard selection, removable multiple-location chips and manual Enter-to-add fallback. Remote can accompany locations; Open to anywhere replaces specific selections.
- Reads the configured GEOIFY_API as the public Geoapify browser key, forwarding only approved public settings to live-main. Keys remain untracked. Attribution is visible. Demo suggestions are fictional and network-free.
- Selected labels remain semicolon-separated location text in the existing search-profile prompt. Browser and scoped MCP profile edits retain shared backend ownership/version validation; autocomplete adds no backend write or approval boundary.
- Validation: 14 targeted tests, frontend typecheck, data validation (158 roles), production static build, clean design detector, browser country/city and keyboard/multi-select checks, mobile screenshot inspection. A bounded live Geoapify lookup returned five results using the configured key.
- Limits: browser UI tests use fictional API responses; no hosted publication. Production builds need their own configured browser key and allowed origins.
