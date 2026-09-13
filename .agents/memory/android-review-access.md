---
name: Android reviewer access decisions
description: Permanent device access, code rotation limits, and external Vercel hosting constraint.
---

Android reviewer access must be separate from RevenueCat subscriptions and must not affect iOS. The intended flow is one server-validated activation granting permanent device access, without renewal or an expiry tied to Google approval.

**Why:** The user chose a reusable reviewer code so Play Console access instructions continue working for future reviews, prioritizing a simple activation-once experience. Without subsequent checks, revoking or rotating the code can stop new activations only; it cannot disable grants already issued.

**How to apply:** Keep review access separate from paid subscription state. Explicitly state the revocation limit in the admin control. Do not claim existing grants can be remotely revoked without changing the agreed design.

The user identifies GitHub → Vercel as the production backend hosting arrangement. The checkout inspected during planning contained no Vercel deployment configuration or live backend URL.

**Why:** A native release must not call a Replit development URL, and an external deployment may not be represented in this checkout.

**How to apply:** Confirm the actual live Vercel backend URL and source before wiring activation endpoints. Do not infer that the external backend does not exist merely because it is absent here.