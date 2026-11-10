# COM02 containment halt

- Propagate hostControlFailed and session/final cleanup failures; skip final sealing and halt the remaining condition without grading/export. Reuses COM03 behavior without a runner rewrite.
- Validation: four focused COM02 Node checks (including Python regressions for unconfirmed turn termination, failed cleanup and pair halt) and catalog validation.
- Limits: no live preflight, participant runs, Docker recovery or product changes. Fictional mocked fixtures supply representative failure coverage; product demo unchanged. Frozen pilots untouched.
