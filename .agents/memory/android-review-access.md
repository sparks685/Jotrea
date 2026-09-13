---
name: Android reviewer access decisions
description: Permanent device access, code rotation limits, and external Vercel hosting constraint.
---

Android reviewer access must be separate from RevenueCat subscriptions and must not affect iOS. The intended flow is one server-validated activation granting permanent device access, without renewal or an expiry tied to Google approval.

**Why:** The user chose a reusable reviewer code so Play Console access instructions continue working for future reviews, prioritizing a simple activation-once experience. Without subsequent checks, revoking or rotating the code can stop new activations only; it cannot disable grants already issued.

**How to apply:** Keep review access separate from paid subscription state. Explicitly state the revocation limit in the admin control. Do not claim existing grants can be remotely revoked without changing the agreed design.

The user clarified that production was a pure Vite frontend on Vercel, not a pre-existing backend. Reviewer validation belongs on the same production domain, not the Replit API artifact.

**Why:** Native releases must not depend on a Replit development URL. The user wants to keep the existing GitHub → Vercel deployment and use Vercel environment-variable administration rather than a separate admin login or database.

**How to apply:** Keep the reviewer code server-only. Rotation or disabling requires updating Vercel Production settings and redeploying, not rebuilding Android. Live readiness also requires the Vercel Firewall rule; an in-memory serverless limiter alone is not durable protection.