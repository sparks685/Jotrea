---
name: Feature gates pattern
description: Where and how free-tier limits are enforced in Jotrea
---

All feature gate logic lives in `src/utils/featureGates.ts`. Never inline free-tier checks — always import from there.

Key exports:
- `FREE_HISTORY_DAYS = 30` — free tier history window
- `filterForFreeTier(items, subscription)` — returns `{ visible, locked }` for any array with a `date` field
- `isCalendarMonthLocked(year, month, subscription)` — true if the entire month is beyond 30 days
- `buildDoseCSV / buildWeightCSV / downloadCSV` — premium-only data export
- `scheduleNextDoseNotification(...)` — schedules a browser notification for the next dose

**Why:** Centralized so feature boundaries are easy to audit and update in one place.

**How to apply:** In any page that renders history (DoseLog, WeightTracker), call `filterForFreeTier` and render a gold lock/upgrade banner for the locked portion. In calendar view, call `isCalendarMonthLocked` and show an overlay.
