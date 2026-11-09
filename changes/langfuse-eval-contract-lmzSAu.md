# Reusable Langfuse evaluation setup

- Added eval-v1 whole-trajectory result contract, common score names and standalone setup/export/verify command. Local dataset correlation IDs avoid creating or changing research datasets.
- Added versioned Eval Overview dashboard configuration with eight comparison-table widgets and seven score definitions; setup preserves existing named dashboard/widget edits.
- Added structural-only fictional result template and adoption documentation. Existing N01/N02 and frozen historical exporters remain unchanged; detached product demo is not connected to telemetry.
- Validation: JavaScript syntax and repository data validation. Live dashboard/configuration read-back recorded separately below. No tests, participant runs, historical grades or synthetic performance uploaded.
- Limits: future result ingestion is not exercised; dashboard API is unstable; shared receipt storage is needed for cross-machine duplicate protection. Metric semantics remain the grader/orchestrator's responsibility.

- Live configuration: Eval Overview v1 created in the configured Langfuse project; seven score configs and all eight dashboard placements read back. Widget metric queries accepted with zero compatible measured rows. No run data uploaded.

## Case/run dashboard follow-up

Replaced the live overview with Eval Case & Run and two native tag filters.
Seven selected-attempt panels replace cross-case rates/medians. Future common
exports add case/run tags and trace repeat metadata; trace labels distinguish
campaign/version collisions. Existing records and participant runs are untouched.
Saved dashboard readback confirms both filters and seven placements; Metrics API
accepted the tag filters. Native custom dropdown labels and populated UI rendering
are not verified. No participant tests or historical uploads were performed.
