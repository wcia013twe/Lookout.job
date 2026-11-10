# Standalone manuscript

- Document the two-file paper distribution in the LaTeX source and resolve the architecture PDF beside the manuscript, with the repository figure directory retained as a fallback.
- Tables and bibliography were already inline in the current manuscript; no additional content inputs are required. Standard LaTeX packages remain necessary.
- Validation: compiled with Tectonic from a separate directory containing only the manuscript and architecture PDF before compilation; no undefined-reference or missing-file warnings. Content-dependency scan confirms the architecture PDF is the only external content input. npm run validate:data passed (158 roles).
- Limits: compiler spacing warnings remain; no scientific claims, application behavior, MCP actions or demo states changed.
