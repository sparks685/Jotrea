---
name: Android reminder policy
description: Why the initial Android release uses best-effort reminders rather than exact-alarm special access.
---

Keep initial Android reminders best-effort and disclose possible battery-related delays. Do not introduce exact-alarm access casually.

**Why:** Exact alarms require a separate Android permission and special-access flow, with Play eligibility implications. The initial port should not silently expand permissions or imply guaranteed delivery.

**How to apply:** If tighter timing is requested later, evaluate Play policy, implement permission denial/revocation handling, and verify idle/reboot behavior on devices before claiming exact timing. Capacitor's allowWhileIdle flag alone does not grant exact-alarm permission.