# Retire the deleted static frontend

Removed the static frontend and its vendored assets instead of retaining a second UI architecture. Shared application progress now lives in lib/tracker-display.mjs and all three React consumers and tracker tests import it there. Authentication is owned by the existing React workspace; CI no longer builds a retired auth bundle.

Preserved the old profile verification safeguard as lib/profile-review.mjs, integrated into the active React editor. Exact scalar/nested facts, trusted review events, invalidation and account hydration are covered by new tests. Existing demo profile uses this same editor/helper; fixtures and account boundaries remain unchanged.

Retired tests of removed custom elements and DOM controllers. Compensation tests now exercise the production role display helper; current pack/reward tests and backend connection/profile tests remain authoritative. Logo manifest/storage tests remain; old custom-element rendering coverage was removed. Updated current architecture and maintenance docs. Historical change notes and generated OpenWiki are unchanged.

Validation: 278 tests passed including database scenarios; 76-role data validation, frontend typecheck and design detector passed. Production static build passed. Browser, interactive demo and live authenticated account flows were not exercised.
