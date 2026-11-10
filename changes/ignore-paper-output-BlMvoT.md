# Ignore generated paper output

- Ignore root paper PDF, LaTeX intermediates and exported paper ZIPs; retain tracked source, figure assets and benchmark table inputs.
- Validation: git check-ignore confirms generated outputs are ignored and tracked manuscript/figure/table source paths remain available; npm run validate:data passed.
- No application, backend, MCP or demo behavior changes.
