---
name: Goal Weight ruler — state-driven drag (final architecture)
description: Why scroll-based rulers fail in Replit iframe previews and how the ruler is actually implemented
---

## Why scroll-based rulers don't work here
`el.scrollLeft` assignments are silently rejected while Framer Motion's enter animation is running inside the Replit iframe preview. The element mounts and has correct dimensions, but the browser refuses to accept programmatic scroll during the CSS transform animation. The ruler stays at scrollLeft=0 (before tick rMin=80), appears blank, and any subsequent user scroll snaps to 80.

Multiple approaches were tried and all failed in this environment:
- Double-RAF with `suppressScrollRef` (scroll rejected during animation)
- `useLayoutEffect` (Framer Motion's transform is applied AFTER layout, so dimensions are stale)
- `scrollSnapType: x mandatory` (browser fires onScroll on mount at invalid snap position, writes rMin before RAF fires)

## Current implementation (state-driven drag)
`goalWeight` React state is the single source of truth. The ruler is a **non-scrolling fixed div** that renders ticks in a ±20 window around `goalWeight`. Horizontal pointer drag updates `goalWeight` directly.

Key refs:
- `dragStartXRef` — clientX at pointerdown
- `dragStartValRef` — goalWeight int at pointerdown  
- `lastDragValRef` — last emitted value (prevents duplicate setState)

Drag sensitivity: 7px per 1 lb unit. `touchAction: 'none'` + `setPointerCapture` on the ruler card ensures smooth drag on mobile and desktop.

+/− stepper buttons (−5, −1, +1, +5) provide alternative input.

Initialization: `useEffect([step])` sets `goalWeight` to `startWeight || currentWeight || 150` whenever `direction === 1` (forward navigation). Back-navigation preserves the user's selection.

**Why:** This eliminates all scrollLeft timing and iframe-environment issues. The ruler is purely presentational — it reads state, never writes it. Only drag/button interactions write goalWeight.

## Do NOT reintroduce scroll-based rulers
Any scrollable ruler with `el.scrollLeft` initialization will break in this iframe environment. If a task agent rewrites this, insist on the state-driven approach.
