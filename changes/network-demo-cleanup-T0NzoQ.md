# Network demo cleanup

- Reduced the Network demo to two visible targets (Cedar and Northstar), two Cedar contacts, and one active process. Kept the archived target behind Show archived and removed the extra platform application.
- Demo entry and reset now use the same focused fixtures instead of adding unrelated outreach examples. Network demo views exclude applications from other demo stories; account and browser records retain their existing behavior.
- Existing scoped company/contact tools and validation are unchanged; this only changes demo presentation and fixtures, with no new product action or backend contract.
- Validation: focused Network and outreach conversation tests, data validation (76 roles), TypeScript, production static build, and diff whitespace check.
- Limits: no interactive browser walkthrough. Mechanical design scan reported one existing border warning on an unchanged process tab.
