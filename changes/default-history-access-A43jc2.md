# Default application-history access

- The default Prepare jobs and applications connection now includes tracking:write, exposing Simplify import preview/save and user-reported progress tools. Connection descriptions explain this access; read-only and context presets stay scoped.
- Updated the fictional connection creation interaction to exercise the shared default preset. MCP discovery and preview regression coverage now use that preset too; no new backend boundary is introduced.
- At the user’s explicit request, granted tracking:write to their newest active existing connection in production. Verified credentials.verify reports the scope and imports.list succeeds; token value and expiry were preserved. Older connections were not changed.
- Validation: npm test (552 passed, including database scenarios and fictional demo interaction), npm run validate:data (158 roles), npm run build (production static export), live scoped credential/import read checks.
- Limits: no user CSV was available or imported in this pass. A live Muse tool-discovery refresh remains client-side. Default preset changes are landed locally; hosted frontend publication was not performed.
