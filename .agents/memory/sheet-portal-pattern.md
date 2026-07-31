---
name: Bottom sheet portal pattern
description: Why bottom sheets in Jotrea must use createPortal to appear above the nav bar
---

## Rule
All full-screen bottom sheet backdrops (fixed inset-0) must be wrapped in `createPortal(..., document.body)`.

**Why:** The `.page-enter` CSS animation (`opacity: 0 → 1`) creates a new CSS stacking context. Any `z-index` on elements inside that context (e.g. `z-[60]`) is only scoped within the page-enter stacking context, not the document root. `<BottomNav>` lives at `z-50` in the root container's stacking context (which is outside page-enter), so it always renders on top of the sheet backdrop regardless of how high `z-[60]` is. `createPortal` renders the sheet as a direct child of `document.body`, escaping the stacking context trap.

**How to apply:**
- Import `createPortal` from `react-dom`
- Wrap the `<AnimatePresence>` block: `{createPortal(<AnimatePresence>...</AnimatePresence>, document.body)}`
- Tests that check for `.fixed` backdrop elements must query `document.body.querySelector(".fixed")` not `container.querySelector(".fixed")`
- Inline expanding cards (no backdrop, no fixed positioning) do NOT need portaling — e.g. WeightTracker's Add Entry card
