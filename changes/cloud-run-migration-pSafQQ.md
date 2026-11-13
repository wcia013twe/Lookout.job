# Cloud Run migration investigation

- The production VM hosts the Node MCP/API, a disabled discovery worker and an HTTPS proxy. The public build configuration targets its address.
- A scale-to-zero migration must preserve Node-only APIs, replace shared search staging and the worker's queue trigger, and arrange reliable event delivery independently of post-response background activity. The existing OAuth issuer and client endpoints must also be accounted for before cutover.
- Validation: inspected repository runtime and live VM configuration; the VM API health endpoint responded. Installed both lockfiles in this checkout. No migration was implemented or deployed and no automated tests were run.
- Limits: current client usage and a complete cost estimate remain unverified. Do not stop the VM until a replacement and its integrations are verified.
