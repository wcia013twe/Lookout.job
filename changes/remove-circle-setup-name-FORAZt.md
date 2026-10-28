# Remove Circle name field from setup

- Removed the “Your name in the Circle” input from setup, including the fictional demo that uses the same component.
- Joining uses the current profile name, or “Circle member” when no name is saved. Existing scoped circles.join behavior is unchanged.
- Validation: onboarding and Circle invite tests, frontend typecheck, catalog validation, and mechanical UI detector.
- Verification limit: no live account join or browser inspection performed.
