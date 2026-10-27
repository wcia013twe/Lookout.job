# Official agent artwork

- Replaced placeholder/letter artwork for Muse, Dots, Grok Bot, ChatGPT, Claude and Gemini with official locally served product assets. Added Claude Duet as a separate selectable provider and exposed Hermes directly in the picker with its official icon and preview artwork.
- Preserved the existing dot provider ID while displaying Dots. Other setup/connection behavior is unchanged. Picker selection remains profile metadata through the existing versioned profile write boundary; no new MCP action or live connection claim.
- Official source URLs and retrieval date are tracked in next-app/assets/agents/sources.json. The shared picker supplies the same artwork in fictional demo views.
- Added image decode checks for all eight requested providers, desktop/mobile screenshots and overflow checking. Corrected the fieldset/grid minimum width so the longer participant strip scrolls inside the mobile picker. Used the original official Claude SVG path for a crisp preview.
- Validation: frontend typecheck, data validation (158 roles), production static build, 11 onboarding/handoff tests, design detector and browser image/flow checks passed. Desktop and mobile screenshots inspected. SVG assets contain no scripts or remote references.
- Limits: artwork/selection does not establish provider connectivity; no hosted publication or live agent invocation.

## Cappy artwork

- Replaced Cappy’s letter placeholder with the existing user-designed purple Lookout buddy in both picker thumbnail and selected preview. Reuses the brand asset without generating or duplicating artwork. Shared demo picker uses the same asset.
- Follow-up validation: typecheck, data validation, and desktop/mobile browser image/flow checks passed; inspected the Cappy mobile capture. No new image generation or backend changes.
