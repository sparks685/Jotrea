---
name: Android paint verification
description: Browser geometry checks cannot establish native WebView painting or system-bar contrast.
---

Treat browser layout checks and Android-native rendering checks as separate evidence.

**Why:** Pixel API 36.1 screenshots showed duplicated painted content on Home and Settings and black status icons on a dark background after browser checks had passed. Correct DOM geometry did not establish correct native painting. The page-wide opacity animation was suspected, not conclusively proven, to cause the duplicate paint.

**How to apply:** Use browser measurements to catch overlap, but require a rebuilt Android emulator/device check for native painting and status icons. A Capacitor platform shim only verifies route selection and browser geometry. Do not claim the Android visual problem is resolved until native evidence confirms it.

Native follow-up evidence (2026-09-25): user screenshots confirmed readable light status icons in dark mode after the appearance-controller change; Settings also appeared orderly. Home's target overlap still persisted. Do not treat removing the page fade as a confirmed fix for Home.

Further evidence (2026-09-26): stacked full-width targets did not eliminate the ghost content; Settings headings appeared within Home. Treat cross-route ghost content as a rendering investigation, not a request for more spacing. Native WebView background and scroll ownership need checking, but their correction is not proof of a compositor fix. If it persists, compare an Android-native screenshot with the IDE emulator preview and inspect live DOM/renderer geometry before changing more layout or disabling acceleration in release.

Device screenshots subsequently reproduced the problem after background/scroll changes: the Settings heading/disclaimer occupied the expected Steps area and the reminder was clipped. Live Android inspection showed zero Settings headings, one Steps button, and one page scroller despite the visible Settings text. This supports a paint issue rather than missing Steps markup.

User screenshots on 2026-09-26 confirmed clean targets, a complete reminder, and an opening Steps sheet after enabling the debug-only software layer and navigating. This establishes a useful diagnostic workaround, not a permanent release fix. Switching layers can itself clear stale content, so compare repeated navigation/theme changes in default versus software mode before concluding hardware acceleration must be disabled.

Follow-up light/dark screenshots were clean after the default-mode comparison was requested, though active layer type was not independently verified. The user then confirmed that stopping and relaunching the app brought the overlap back. Layer switching is only temporary recovery. Compare the emulator graphics backend with a cold boot before adding startup redraw hacks or disabling acceleration on physical devices.

Separate native verification on 2026-09-26: the user confirmed screenshots showing the supplied Jotrea artwork on both the Pixel launcher and startup splash. This confirms branding in that installed test build, not the published Play release or resolution of the Home/Settings paint issue. Keep those verification claims separate.

Physical-device comparison on 2026-09-26: after the internal update arrived, the user reported the Odin looked good. Photos showed clean separate Home targets and an open Steps sheet, unlike the Pixel emulator's duplicate painting. They also showed missing target icon colors and light side strips in dark mode. Treat this as positive device-specific layout evidence, not proof that the emulator issue or all Android styling is fixed.

Landscape rotation photos clarified that the Odin's bright side strips were the exposed full-width background outside the centered content. Keep the outer canvas theme-aware from first paint; do not restore a permanently cream startup background to address launch continuity. Preserve readable centered content rather than stretching the cards to hide the gutters. This issue is separate from native system-bar contrast and emulator duplicate painting.