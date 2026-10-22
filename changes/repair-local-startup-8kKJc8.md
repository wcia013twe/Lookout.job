# Local dashboard startup recovery

- Diagnosed missing Linux Lightning CSS native dependencies and a corrupt Turbopack cache in the shared checkout. Stopped the unresponsive development server.
- Restored locked dependencies in the isolated task checkout and started the dashboard there on localhost:3000 with a fresh generated cache and the existing ignored local environment configuration. No application or catalog changes were needed.
- Validation: feature:doctor passed; npm ci and npm ci --prefix next-app completed; native CSS module loaded; validate:data passed (76 roles); HTTP GET / and /profile/ returned 200.
- Limits: browser interactions and authenticated backend behavior were not tested. The running server uses the retained task checkout; the shared checkout dependency/cache state was not modified. Demo fixtures and MCP mappings are unchanged because no product behavior changed.
