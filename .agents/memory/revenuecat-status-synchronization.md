---
name: RevenueCat status synchronization
description: Keep Jotrea's shared Plus state consistent with successful RevenueCat refreshes.
---

Every successful automatic RevenueCat status refresh must persist its result to Jotrea's shared user state. While a native status check is pending, show a checking state rather than assuming the user is Free.

**Why:** The Plus page could independently detect an active entitlement while Settings retained a stale Free value. Users may interpret that contradiction as a failed payment and should not need Restore Purchases during normal startup. Physical-device sandbox testing confirmed that an active entitlement returns automatically after deleting and reinstalling the app from Xcode, without tapping Restore Purchases.

**How to apply:** Treat RevenueCat as the native source of truth, propagate successful refresh results to shared state, reserve Restore Purchases for explicit recovery, and do not display Free until the current check resolves.