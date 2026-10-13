# Incremental React migration

Isolated Next.js App Router + React + Tailwind foundation. Production continues to use the root static board. No deployment switch, storage migration or auth change is included in this first step.

```sh
cd next-app
npm ci
npm run dev
npm run build
```

The `/profile/` preview consumes `../profile-schema.js`, the same field schema used by the production editor. Preview edits intentionally remain unsaved until account-scoped store/cloud adapters and verification handling reach parity. Avoid introducing a second localStorage key or bypassing existing approval rules.

Server components provide the shell; only the interactive form is a client component. Tailwind builds locally with PostCSS. Static export supports the existing Pages hosting model; set `NEXT_PUBLIC_BASE_PATH=/codex-automated-job-board` when building for that project path. Do not publish `out/` over the board yet.

Next steps: extract the account/store adapter with tests, port verification and resume controls, verify auth + cloud parity, then opt in to a preview route before migrating other tabs. Preserve the root Web Components during coexistence.
