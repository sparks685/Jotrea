---
name: Ruler suppressScrollRef fix
description: How to prevent the Goal Weight ruler from snapping back to rMin (80) on mount or after programmatic scroll
---

## The bug
After programmatically setting `el.scrollLeft` via double-RAF, any scroll event that fires in the 60ms window before the snap timer runs will snap the ruler BACK to the old position. On mount, `scrollLeft=0` triggers an `onScroll` that writes `rMin` (80) into state and queues a snap timer. The double-RAF fires ~33ms later and corrects the position, but the snap timer fires at 60ms and overrides it back to 80.

## The fix
A `suppressScrollRef = useRef(false)` flag wraps every programmatic scroll:

```js
suppressScrollRef.current = true;
if (snapTimerRef.current) clearTimeout(snapTimerRef.current); // cancel pending snap
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    el.scrollLeft = target;
    setTimeout(() => { suppressScrollRef.current = false; }, 200);
  });
});
```

In `onScroll`: `if (suppressScrollRef.current) return;`

**Why:** The 200ms window covers: 2 RAF frames (~33ms) + any delayed CSS/snap browser events + buffer.

## What NOT to do
- Do not add `goalWeight` to the `useEffect` dep array — `onScroll` owns `goalWeight`; adding it creates a feedback loop that re-runs init on every scroll tick.
- Do not use `scrollSnapType: x mandatory` — browsers fire a scroll event on mount when `scrollLeft=0` is an invalid snap position, writing rMin into state before init can run.
- Do not use `useLayoutEffect` instead of double-RAF — Framer Motion's enter animation runs after layout, so dimensions may be stale at layout-effect time.
