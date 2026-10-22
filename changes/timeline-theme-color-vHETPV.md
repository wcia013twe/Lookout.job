# Theme-aware application timeline

- Replace hardcoded amber milestones with the shared theme accent; upcoming milestones use the shared muted foreground. Applies to horizontal, vertical, and Circle timelines in both themes.
- Preserve the current-step ring, filled completed steps, hollow upcoming steps, labels, dates, and behavior.
- Demo coverage: existing fictional tracker and Circle application fixtures use the same component and inherit this update; no fixture or interaction changes required.
- MCP mapping: presentation-only change; existing application progress tools and validation are unchanged.
- Validation: `npm run validate:data` passed. CSS diff verified against dark/light theme tokens. No browser visual verification performed.
