# Shared subscription independent grader

- Added a minimal direct CLI/Docker grading invocation using pinned subscription runtime, read-only evidence and separate review output; fixed exact Terra-medium settings and observed-model validation. Reused shared containment/timing/usage helpers.
- Validation: four mocked boundary checks for exact settings, credential/symlink rejection, successful JSON collection and wrong-model rejection; catalog validation.
- Limits: live subscription grading pending serialized host availability. JSON collection is not semantic/schema acceptance; owning case grader validates afterward. No participant experiments, product changes or deployment. Fictional mocked boundary fixtures supply representative coverage.
