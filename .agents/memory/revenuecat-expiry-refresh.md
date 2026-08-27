---
name: RevenueCat expiry refresh
description: Native entitlement refresh behavior needed to revoke expired Jotrea Plus access reliably.
---

Native launch-time entitlement checks must invalidate RevenueCat's cached CustomerInfo before requesting the current status.

**Why:** An expired Apple sandbox trial showed no current entitlement in RevenueCat, but a force-closed app still retained locally persisted Plus access after relaunch because stale CustomerInfo could survive native launches.

**How to apply:** Any native startup or foreground reconciliation that updates locally persisted subscription state should force a fresh RevenueCat CustomerInfo read before deciding whether Plus is active.