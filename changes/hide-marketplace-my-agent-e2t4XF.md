# hide-marketplace-my-agent

- Removed the embedded theme Marketplace from My Agent → Appearance; the standalone themes route is unchanged.
- Validation: `npm run validate:data`, Next app typecheck, production build, and the desktop/mobile Appearance UI check pass.
- Validation limit: `npm test` fails in existing search-pipeline/filter cases because the Feishu portal module imports missing `MACOS_BROWSER_LIKE_USER_AGENT` from `runner/vendor/career-ops/_http.mjs`; these failures are outside this UI change.
- Build warning: existing imports of `useSlice` in `lib/network.jsx` and `lib/outreach.jsx` are not exported by the locally modified workspace module.
