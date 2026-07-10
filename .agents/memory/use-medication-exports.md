---
name: useMedication hook exports
description: The useMedication.ts file exports 4 separate named hooks
---

`src/hooks/useMedication.ts` exports four separate named hooks (not a single default):
- `useMedication()` → `{ medication, setMedication }`
- `useDoses()` → `{ doses, setDoses }`  
- `useWeights()` → `{ weights, setWeights }`
- `useUser()` → `{ user, setUser }`

**Why:** Avoids re-renders — components only subscribe to the slice of state they need.

**How to apply:** Import named: `import { useMedication, useUser } from "@/hooks/useMedication";`
