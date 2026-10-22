# toolkit-discovery

- A connected agent can now discover all 37 Career Toolkit workflows through the scoped `discover_toolkit` MCP tool, select a matching workflow from an ordinary career request, and load its complete guide through `read_guide`. Updated connection and Toolkit copy explains that users do not need to install or name individual skills.
- Added automatic-routing instructions to the gateway and MCP initialization contract, versioned every generated guide so existing connections reload the behavior, and added fictional demo discovery examples.
- Validation: Career Toolkit generation check; focused Career Toolkit, guide, MCP protocol, and search-context tests; `npm run validate:data`; production Next.js build; full `npm test` after local landing (429 passed). The PGlite harness aborts from the temporary Linux checkout after three scenarios, so the full suite was run from the main checkout filesystem.
- Limits: no external agent host or production deployment was exercised. Lookout advertises and serves the workflows after connection, but each host still controls model routing, wakeups, and recurring scheduling.
