---
name: getNextDoseDate returns Date
description: The return type of getNextDoseDate is Date, not string
---

`getNextDoseDate(startDate, frequency, doses)` in `src/utils/dates.ts` returns a `Date` object, **not** a string.

**Why this matters:** When passing to functions that expect a string (like `scheduleNextDoseNotification`, which takes `nextDoseDate: string`), or when rendering in JSX, you must call `format(date, "yyyy-MM-dd")` first.

**How to apply:** `const nextDoseDate = nextDoseDateObj ? format(nextDoseDateObj, "yyyy-MM-dd") : null;`
