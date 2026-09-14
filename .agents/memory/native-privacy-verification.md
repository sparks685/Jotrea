---
name: Native privacy verification
description: Release-specific evidence and boundaries for health analytics claims
---

Base mobile privacy declarations on the actual submitted AAB or IPA and its compiled configuration. Do not infer that analytics runs merely because its component or event calls exist in source.

**Why:** Inspection of a user-supplied Android release found Google Analytics eliminated from compiled JavaScript despite medication-name events in source. The retained Speed Insights component used a local-origin script path with no bundled script or remote configuration, not a working Vercel collection endpoint.

Treat medication-payload removal as future-release/website protection, not a reason to enable analytics or ship a native release. Retaining health-related event names is not a finding of policy compliance.

**Why:** The requested privacy hardening deliberately preserves analytics enablement and native behavior; activity names and health-screen page views can still reveal sensitive context without medication parameters.

**How to apply:** Report residual activity metadata separately, and obtain a separate policy decision before changing collection, consent, or store disclosures.

**How to apply:** Confirm native manifest identity, inspect all bundled entrypoints and SDK configuration, and trace relative URLs against the Capacitor origin. Treat each subsequent release independently. Static inspection establishes configured behavior, not an observed network capture; use device network inspection when runtime behavior remains ambiguous. Do not generalize Android findings to the website or iOS.