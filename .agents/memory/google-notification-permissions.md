---
name: Google notification permissions
description: RevenueCat topic creation may require Pub/Sub Admin despite valid credentials and Editor.
---

RevenueCat's automatic Google notification connection can require Pub/Sub Admin where Pub/Sub Editor fails.

**Why:** In this project's setup, purchase validation worked, the Pub/Sub API was enabled, and Editor plus Monitoring Viewer were present, but topic creation still failed. Changing Editor to Pub/Sub Admin succeeded, matching RevenueCat's documented exception.

**How to apply:** Check the API and documented roles first; do not grant project Owner or recreate credentials to fix this error. Explain the broader Pub/Sub permission before changing it. A successful connection still requires the topic to be configured in Google Play and a test notification received by RevenueCat.