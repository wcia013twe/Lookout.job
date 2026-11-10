# Langfuse tracing

- Installed official Langfuse skill separately in the local Codex skills directory.
- Added optional Node API/worker tracing with structural IO, credential masking, graceful flush and preserved application outcomes; added an explicit Docker activation overlay.
- Added versioned standalone Codex log importer with original timestamps, run/session grouping, metadata, bounded OTLP batches, import receipts and offline preview. Existing frozen harness and campaign data are unchanged.
- Added fictional offline tracing fixture and setup/OpenWiki documentation. Detached product demo and MCP/domain contracts remain unchanged.
- Validation: backend TypeScript compilation, JavaScript syntax checks and offline N01 structural preview (four traces / 56 observations). No test suite or participant runs executed.
- Limits: user declined stale historical export; no live ingestion/read-back or active backend rebuild performed. No hosted Edge/intelligence tracing, per-model-call inference reconstruction, score upload or dataset registration. Existing unrelated root .env.example edits are preserved.
