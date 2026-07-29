---
name: useLocalStorage cross-component sync
description: The native `storage` event only fires cross-tab. Same-page components using the same key won't sync unless a synthetic event is dispatched.
---

## The rule
After writing to localStorage, dispatch a synthetic `StorageEvent` so all `useLocalStorage` instances on the same page update in real time.

## Why
`App.tsx` and `Onboarding.tsx` both call `useMedication()`. When Onboarding called `setMedication()`, App.tsx's copy stayed `null` because the `storage` event only fires between different browser tabs. After navigation to `/`, App.tsx saw `medication = null` and redirected back to onboarding.

## How to apply
In `artifacts/jotrea/src/hooks/useLocalStorage.ts`, the `setValue` function dispatches after every write:
```ts
window.dispatchEvent(new StorageEvent("storage", { key, newValue: serialized }));
```
The existing `handleStorageChange` listener already handles this correctly. No other changes needed.

**Side effect**: every `setValue` call now causes all same-key consumers to re-render. Avoid calling setters inside render or in tight loops.
