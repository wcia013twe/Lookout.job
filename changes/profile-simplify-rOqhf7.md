# Readable About me blocks

- Adapted the supplied Simplify PDF's content-block layout: readable background header, experience and education timelines, project descriptions, contact/link summaries, and skill chips. Expand a block to edit using the existing controls.
- Combined name/contact groups and moved profile-specific account assignments and eligibility into a disclosure after shared background. Hide the application-profile save bar on About me until those settings change; shared background retains its separate save/review boundary. Existing settings remain accessible.
- Admin demo: enriched fictional profile metadata, links, skills and timeline dates; real and demo profiles use the same editing interactions and existing reset mechanism.
- MCP mapping: unchanged shared background save (`profile.save`) and versioned application-profile preference save; presentation-only changes introduce no new backend action or advertised capability.
- Validation: 413 tests passed (including database scenarios) outside the sandbox, data validation passed (76 roles), TypeScript and production static build passed, mechanical design detector returned no findings. Initial sandbox test run failed three subprocess-based suites; full output retained in /tmp/profile-simplify-tests.log and /tmp/profile-simplify-tests-full.log.
- Verification: isolated Chromium with fictional browser-local data and external requests blocked; desktop/mobile overflow and background edit/save checks. No live account or production deployment verification.
