---
name: Framer Motion ease typing
description: How to type ease values for framer-motion without TS2322
---

When using `ease` in framer-motion `transition` objects, TypeScript requires it to be typed as `Easing[]` or a cubic-bezier tuple `[number,number,number,number] as const`. A plain string like `"easeOut"` causes TS2322.

**Why:** The framer-motion types are strict about the `Easing` union type.

**How to apply:** Use `ease: "easeOut" as const` or avoid `ease` entirely and use `type: "spring"` or `type: "tween"` with named easing strings.
