# White company-logo backgrounds

- Removed the tracker image background override so Logo.dev icons inherit the shared white background in both themes. Briefcase fallbacks retain the shared themed background.
- The detached admin demo uses the same tracker renderer and inherits this correction; no fixtures or interactions changed.
- Validation: catalog validation (158 roles), frontend typecheck, three company-logo tests and mechanical design detector passed. Production static build passed.
- Limits: no browser visual verification or hosted publication. No service action or MCP contract changed.
