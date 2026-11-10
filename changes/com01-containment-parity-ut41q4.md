# COM01 containment parity

- Reused shared stop helper and COM02 cleanup/failure handling in COM01. Unconfirmed participants cannot be sealed, graded/exported or followed by the other condition.
- Validation: seven focused COM01/COM02 checks including mocked timeout, cleanup, run finalization and pair halt; catalog validation.
- Limits: no Docker commands, live preflight or participant execution in regression checks. Frozen pilots preserved; new source needs fresh freeze/preflight. Fictional failure fixtures provide demo coverage; product unchanged.
