---
name: Imported artifact workflows
description: Workflow behavior after importing an artifact monorepo into a workspace
---

Imported projects can contain valid artifact metadata while the workspace workflow registry is empty. Configuring ad hoc workflows without the artifact-managed environment can start the commands without `PORT`, causing the API process to fail before it serves.

**Why:** The app’s server intentionally throws when `PORT` is missing, and the artifact metadata normally supplies the runtime port.

**How to apply:** Check `listWorkflows()` before restarting. If none exist, use the artifact service registration or configure verification workflows with the exact artifact ports, then verify through the shared proxy rather than direct service ports.