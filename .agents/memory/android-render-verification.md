---
name: Android paint verification
description: Browser geometry checks cannot establish native WebView painting or system-bar contrast.
---

Treat browser layout checks and Android-native rendering checks as separate evidence.

**Why:** Pixel API 36.1 screenshots showed duplicated painted content on Home and Settings and black status icons on a dark background after browser checks had passed. Correct DOM geometry did not establish correct native painting. The page-wide opacity animation was suspected, not conclusively proven, to cause the duplicate paint.

**How to apply:** Use browser measurements to catch overlap, but require a rebuilt Android emulator/device check for native painting and status icons. A Capacitor platform shim only verifies route selection and browser geometry. Do not claim the Android visual problem is resolved until native evidence confirms it.

Native follow-up evidence (2026-09-25): user screenshots confirmed readable light status icons in dark mode after the appearance-controller change; Settings also appeared orderly. Home's target overlap still persisted. Do not treat removing the page fade as a confirmed fix for Home.

Further evidence (2026-09-26): stacked full-width targets did not eliminate the ghost content; Settings headings appeared within Home. Treat cross-route ghost content as a rendering investigation, not a request for more spacing. Native WebView background and scroll ownership need checking, but their correction is not proof of a compositor fix. If it persists, compare an Android-native screenshot with the IDE emulator preview and inspect live DOM/renderer geometry before changing more layout or disabling acceleration in release.

Device screenshots subsequently reproduced the problem after background/scroll changes: the Settings heading/disclaimer occupied the expected Steps area and the reminder was clipped. No mitigation is confirmed. Obtain live DOM counts for Settings headings and Steps buttons on Home before choosing a route/bundle fix versus a renderer investigation; do not keep guessing from screenshots.