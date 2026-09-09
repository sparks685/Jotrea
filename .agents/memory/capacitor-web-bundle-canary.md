---
name: Capacitor web-bundle canary
description: Prevent physical-device retests from silently using stale Jotrea web assets.
---

Before opening Xcode for a native retest, verify a distinctive string from the intended source change exists in both the Vite `dist` bundle and Capacitor's copied iOS public bundle.

**Why:** A newly generated export timestamp proves only that the installed app ran; it does not prove that Vite rebuilt or Capacitor copied the latest source. Jotrea repeatedly produced new PDFs from an old installed bundle after build commands referenced the wrong binary locations.

**How to apply:** Build from the Jotrea artifact with its local Vite binary, sync with its local Capacitor binary, grep both generated bundles for a visible canary string, then clean and run from Xcode.