# Reusable Langfuse evaluation setup

- Added eval-v1 whole-trajectory result contract, common score names and standalone setup/export/verify command. Local dataset correlation IDs avoid creating or changing research datasets.
- Added versioned Eval Overview dashboard configuration with eight comparison-table widgets and seven score definitions; setup preserves existing named dashboard/widget edits.
- Added structural-only fictional result template and adoption documentation. Existing N01/N02 and frozen historical exporters remain unchanged; detached product demo is not connected to telemetry.
- Validation: JavaScript syntax and repository data validation. Live dashboard/configuration read-back recorded separately below. No tests, participant runs, historical grades or synthetic performance uploaded.
- Limits: future result ingestion is not exercised; dashboard API is unstable; shared receipt storage is needed for cross-machine duplicate protection. Metric semantics remain the grader/orchestrator's responsibility.

- Live configuration: Eval Overview v1 created in the configured Langfuse project; seven score configs and all eight dashboard placements read back. Widget metric queries accepted with zero compatible measured rows. No run data uploaded.
