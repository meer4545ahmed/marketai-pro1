---
name: OpenAPI and Zod compatibility
description: A generator/runtime compatibility constraint discovered while extending the shared API contract.
---

When extending the OpenAPI contract in this workspace, prefer numeric schemas
over `type: integer` unless the generated Zod runtime is upgraded to support
the emitted integer helper.

**Why:** The current Orval output targets the installed Zod 3 runtime, where
integer schemas can emit `zod.int()` and fail the shared library typecheck.

**How to apply:** After any OpenAPI change, run codegen and the root
`pnpm run typecheck`; if integer output is needed, update the generator/runtime
compatibility deliberately rather than patching generated files.