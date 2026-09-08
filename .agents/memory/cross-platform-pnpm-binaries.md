---
name: Cross-platform pnpm binaries
description: Preserve native JavaScript build-tool binaries for both Replit Linux and local macOS development.
---

Do not remove macOS variants of Rollup, esbuild, Lightning CSS, or Tailwind Oxide from the shared pnpm dependency graph.

**Why:** Jotrea is built on Replit but archived on an Apple Silicon Mac. Linux-only overrides produce a valid Replit install while making clean local Vite builds fail with missing native-module errors.

**How to apply:** Package-pruning rules may exclude unsupported platforms, but must retain both Linux x64 and macOS ARM64/x64 variants used by the development and release environments.