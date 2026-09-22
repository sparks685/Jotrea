---
name: Fresh state for conversion regressions
description: Hot reload can preserve values produced by old unit-conversion logic and make a correct fix appear broken.
---

Verify state-conversion fixes from an explicit fresh baseline, not only a component left mounted during hot reload.

**Why:** A browser retest retained a previously rounded metric height through HMR, reproducing the old BMI discrepancy despite corrected conversion code. A fresh context with explicitly selected imperial inputs confirmed the fix.

**How to apply:** When source tests and browser values disagree after an edit, reload or use a new isolated context, explicitly set the starting inputs, and inspect the selected DOM values. Preserve separate coverage for real persisted user data; do not clear user records to hide migration problems.