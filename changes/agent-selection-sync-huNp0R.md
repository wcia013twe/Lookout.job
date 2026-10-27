# Sync agent selection with My Agent

Shared agent catalog and saved preference connect setup with the My Agent dropdown.
Migrate legacy candidate-profile UI fields so validated profile writes can sync.
Use selected agent names for onboarding credentials; existing saved connection records
remain the access authority. Demo includes a resettable Muse preference.

Validation: npm test (849 passing), focused agent-selection tests (4 passing, including demo reset), npm run validate:data (158 roles), production build and git diff --check passed.
Limits: no live account or external connector handshake verified. Human selection uses
the existing setup boundary; existing credential tools and workspace reads are unchanged.
