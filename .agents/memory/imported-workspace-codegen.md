---
name: Imported workspace codegen
description: Environment-specific note for generating typed clients in imported pnpm workspaces
---

Imported workspaces can install the Linux esbuild package with its binary mode missing, causing Orval to fail with `EACCES` even though dependencies are present.

**Why:** The repo may have been imported with package metadata from another platform, while the current container needs the Linux executable bit restored.

**How to apply:** If Orval reports `spawn .../@esbuild/linux-x64/bin/esbuild EACCES` after a clean install, restore execute permission on that binary and rerun the existing codegen command; do not change the project’s bundler or dependency stack.