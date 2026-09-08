---
name: Capacitor iOS launch continuity
description: Preventing a black interval between the iOS launch storyboard and Jotrea's first React frame.
---

On iOS, matching the launch storyboard, Capacitor WebView, and HTML background colors is not sufficient to prevent a black startup interval. Keep the official Capacitor splash visible with automatic hiding disabled, then hide it only after React has painted.

**Why:** On a physical iPhone, the native launch storyboard was dismissed while WebContent and GPU processes were still starting. The underlying WebView remained black for roughly two seconds even after a fresh install and fixed background colors.

**How to apply:** Preserve the manual splash lifecycle whenever changing Capacitor startup code or dependencies. Verify it with a deleted-and-reinstalled physical-device build, not only a browser preview or warm launch.