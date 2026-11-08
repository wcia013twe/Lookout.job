# Muse application request intake

- Comment out the deterministic provider allowlist in Muse request intake. Retain HTTPS shape, ownership, connection scopes, versions, retry identity and human stop checks. Website and MCP share the writer; deterministic execution and receipt-platform support stay unchanged.
- Show plain-object RPC error messages instead of hiding queue failures. Add a fictional Workday demo posting, retaining detached queue/pickup/outcome interactions.
- Validation: npm test (including database website/MCP parity, Workday and other HTTPS-provider intake), npm run validate:data, frontend typecheck and production build.
- Limits: no employer form, real submission or actual Muse host wake verified. Hosted deployment separate.
