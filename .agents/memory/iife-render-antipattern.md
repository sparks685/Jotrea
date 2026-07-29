---
name: IIFE-in-JSX anti-pattern
description: Never place side-effectful IIFEs as JSX children inside a Switch — they run on every render, not just on route match.
---

## The rule
Never use `{(() => { sideEffect(); return <Element/>; })()}` as a JSX child inside a Wouter `<Switch>` (or any component that evaluates all children's JSX on every render). Side effects in JSX expressions run during evaluation, not during mounting.

## Why
A `<Route path="/reset">` IIFE that called `localStorage.clear()` ran on every re-render of the Switch (every route change, every state update), silently wiping all persisted data. Pages went blank because child components re-initialized their `useLocalStorage` hooks from the now-empty storage.

## How to apply
For any route that must perform a side effect on activation, use a dedicated component with `useEffect`:
```tsx
function ResetAndRedirect() {
  const [, setLoc] = useLocation();
  useEffect(() => { localStorage.clear(); setLoc("/onboarding", { replace: true }); }, []);
  return null;
}
// Then: <Route path="/reset"><ResetAndRedirect /></Route>
```
