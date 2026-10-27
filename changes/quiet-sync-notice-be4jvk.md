# Quiet background sync interruption

- Removed the user-facing “Connection interrupted. Your edits are kept here; syncing will retry automatically.” notice from transient background read retries. Retry scheduling/backoff, local edit preservation, explicit save errors and profile conflicts are unchanged.
- Updated recovery coverage to verify failed background reads stay silent while still scheduling a retry and recovering when online. No product action, backend contract or MCP change; detached demo has no account syncing.
- Validation: all 846 tests, data validation (158 roles), production static build and whitespace check passed. No hosted deployment.
