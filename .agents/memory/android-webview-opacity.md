---
name: Android WebView theme opacity
description: Why Android releases need legacy theme-opacity fallbacks.
---

Keep legacy theme-opacity compatibility in the Android preparation path, without changing the iOS build pipeline.

**Why:** A physical Android device using WebView 109 displayed solid theme-color backgrounds instead of translucent fills, hiding same-color dose/site labels and icons. Tailwind's optimized CSS uses an opaque fallback when variable-based color mixing is unsupported. Installing Google's WebView did not change the active system provider on that device.

**How to apply:** Preserve dynamic theme variables and alpha when modifying this compatibility layer. Check the emitted CSS and Android packaged assets, not only source classes. Verify actual older-device rendering before claiming the issue is resolved; modern-emulator success is insufficient.