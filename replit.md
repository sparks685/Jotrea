# Jotrea

A premium GLP-1 medication tracker PWA — mobile-first, feels like a native iOS app.

## Run & Operate

- `pnpm --filter @workspace/jotrea run dev` — run the app (assigned port via workflow)
- `pnpm --filter @workspace/jotrea run typecheck` — typecheck the frontend
- `pnpm run typecheck` — full typecheck across all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite + Tailwind CSS v4
- State: React Context + localStorage (no backend)
- Charts: Recharts
- Animations: Framer Motion
- Icons: lucide-react
- Routing: wouter

## Where things live

- `artifacts/jotrea/src/` — main app source
- `artifacts/jotrea/src/data/medications.ts` — hardcoded GLP-1 medication database (11 meds)
- `artifacts/jotrea/src/types/index.ts` — shared TypeScript types
- `artifacts/jotrea/src/hooks/` — useLocalStorage, useMedication, useWeights, useUser, useNotifications
- `artifacts/jotrea/src/utils/dates.ts` — dose scheduling calculations
- `artifacts/jotrea/src/utils/calculations.ts` — BMI, streak, weight loss math
- `artifacts/jotrea/src/pages/` — Onboarding, Dashboard, DoseLog, WeightTracker, MedInfo, Settings
- `artifacts/jotrea/src/components/` — BottomNav, CountdownRing, PremiumModal, LockOverlay, PremiumBadge
- `artifacts/jotrea/src/index.css` — full brand palette (terracotta/sage/cream)

## Architecture decisions

- **No backend** — all state in localStorage; the app is fully offline-capable
- **Onboarding gate** — app redirects to /onboarding if no medication is set; seeds demo data on first completion
- **Premium is UI-only** — tapping "Start Free Trial" sets `subscription: "premium"` in localStorage, no real payment
- **Framer Motion AnimatePresence** on tab transitions and modal sheets for native-app feel
- **Recharts** used for weight trend chart on Dashboard and full chart on Weight tab

## Product

A complete GLP-1 medication tracker with:
- 3-step onboarding (welcome → select med → set dose)
- Dashboard with circular countdown ring, dose log button, streak counter, mini weight chart
- Calendar dose log with color-coded day dots (taken/scheduled/missed)
- Weight tracker with trend chart, BMI, goal progress bar
- Med info with expandable sections and premium-locked drug interaction checker
- Settings with subscription management and premium upgrade modal
- Premium paywall UI throughout (gold crown, blur overlays)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run typecheck before pushing — framer-motion `ease` must be typed as `Easing[]`, not a plain string
- The `useMedication` hook file exports four separate hooks (useMedication, useDoses, useWeights, useUser)
- Demo data is seeded in localStorage on onboarding completion (4 past doses + 5 weight entries)
