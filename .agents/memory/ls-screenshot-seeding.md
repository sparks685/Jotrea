---
name: App Store screenshot generation
description: How to generate App Store screenshots (PNG) from static HTML mockup files in this NixOS Replit environment.
---

# App Store Screenshot Generation

## The approach
Screenshots are generated from static HTML files in `marketing/screenshots/`. Each HTML file is a pixel-perfect mockup at the exact App Store dimensions.

## Dimensions
- iPhone 6.7" display: **1290×2796**
- iPad 11" display: **2064×2752**

## Source files
- `s1-onboarding.html` / `ipad-s1-onboarding.html` — Welcome screen (step 0)
- `s2-goal-weight.html` / `ipad-s2-goal-weight.html` — Goal Weight ruler (step 5)
- `s3-dashboard.html` / `ipad-s3-dashboard.html` — Dashboard
- `s4-weight-tracker.html` / `ipad-s4-weight-tracker.html` — Weight Tracker

## Output files
- `Jotrea-S1.png` … `Jotrea-S4.png` (iPhone)
- `Jotrea-iPad-S1.png` … `Jotrea-iPad-S4.png` (iPad)

## Rendering command (NixOS)
Use `nix-shell -p chromium` to get a working chromium binary (the prebuilt puppeteer/playwright chromium fails with missing glib on NixOS):

```sh
nix-shell -p chromium --run "chromium --headless --no-sandbox --disable-gpu \
  --screenshot='/abs/path/to/Jotrea-S1.png' \
  --window-size=1290,2796 \
  'file:///abs/path/to/s1-onboarding.html'"
```

**Why:** Prebuilt Chrome binaries (puppeteer, playwright) fail with `libglib-2.0.so.0: cannot open shared object file` on NixOS. The nix-packaged chromium (`nix-shell -p chromium`) has all dependencies resolved by nix and works correctly.

## Automation script
`marketing/screenshots/generate-screenshots.js` — runs all 8 jobs via shell exec with the nix-shell command above.

## Design notes
- Brand color: `#D4A574` (warm tan)
- Background: `#FFFDF7` (cream)
- Caption bands use gradient overlays for visual interest
- Each screenshot shows: caption band (marketing headline) + app screen mockup + bottom callout
