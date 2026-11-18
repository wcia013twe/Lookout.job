# Stale preferences save conflict

- Return PT409 for stale versions on the agent preferences RPC and the browser card-pack settings RPC. The browser keeps its reload guidance and the agent gateway maps PT409 to HTTP 409.
- Validation covers both SQL entry points, hosted upgrade convergence, and the browser conflict message. The demo saves in memory and does not exercise PostgREST retries.
- Hosted rollback and WAL rates require a separate production check after deployment.
