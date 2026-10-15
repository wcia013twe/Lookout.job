# Agent workflow hardening

- Added a feature-environment doctor, actionable setup errors and GitHub SSH-to-HTTPS normalization for isolated checkouts.
- Documented that this npm-managed repository must not use pnpm as a fallback and limited computer use to visual tasks requiring iterative inspection.
- Validation: targeted feature-delivery tests passed before the user requested no further test runs; data validation reported 76 valid roles.
- Limits: host-level Node.js/npm installation and sandbox permissions remain environment responsibilities; the preflight reports them but does not modify the host.
