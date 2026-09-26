---
name: Android WebView theme opacity
description: Why Android releases need legacy theme-opacity fallbacks.
---

Keep legacy theme-opacity compatibility in the Android preparation path, without changing the iOS build pipeline.

**Why:** A physical Android device using WebView 109 displayed solid theme-color backgrounds instead of translucent fills, hiding same-color dose/site labels and icons. Tailwind's optimized CSS uses an opaque fallback when variable-based color mixing is unsupported. Installing Google's WebView did not change the active system provider on that device.

**How to apply:** Preserve dynamic theme variables and alpha when modifying this compatibility layer. Check the emitted CSS and Android packaged assets, not only source classes. Verify actual older-device rendering before claiming the issue is resolved; modern-emulator success is insufficient.

Physical-device confirmation: after a Google Play update, the user confirmed improvement and photos showed readable dashboard icons, the frequency badge, selected dose/site labels, and the current-step badge on the older WebView. Reinstalling before the update became available had still delivered the old rendering. Check update availability before treating unchanged device behavior as a failed fix. Light-theme device confirmation does not verify dark-theme rendering.

Keep a legacy-compatible gradient fallback as well as opacity fallbacks.

**Why:** On 2026-09-13, the user's AYN Odin photo confirmed the Plus header's colored background and readable text after the gradient fallback, replacing its nearly white faded appearance. Opacity compatibility alone had not fixed that separate issue.

**How to apply:** Preserve both compatibility behaviors in Android preparation. This confirms light-theme rendering on the Odin, not dark-theme rendering or testing on Android phones; a photographed screen does not establish exact color matching.

Opacity compatibility does not cover Tailwind's OKLCH palette tokens. Essential semantic colors must also have legacy sRGB values.

**Why:** Odin photos showed black/white daily-target icons while HSL brand colors and emoji remained colored; the packaged palette for those icons used OKLCH. This is a separate compatibility risk from opacity and compositor ghosting.

**How to apply:** Avoid unsupported color tokens for critical native indicators, and check shipped values as well as modern-browser appearance.

Physical-device confirmation on 2026-09-26: subsequent Odin photos showed blue Water, coral-red Protein, and green Steps icons in both light and dark modes after the sRGB correction. This validates that compatibility approach on the device, not exact photographic color accuracy. Bright side strips remain visible in dark mode; the separate emulator painting issue is not established as resolved.