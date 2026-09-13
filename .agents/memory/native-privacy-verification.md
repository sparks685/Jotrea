---
name: Native privacy verification
description: Use the submitted native bundle, not source or website configuration, to verify mobile analytics.
---
Base mobile privacy declarations on the actual submitted AAB or IPA and its compiled configuration. Do not infer that analytics runs merely because its component or event calls exist in source.

**Why:** Inspection of a user-supplied Android release found Google Analytics eliminated from compiled JavaScript despite medication-name events in source. The retained Speed Insights component used a local-origin script path with no bundled script or remote configuration, not a working Vercel collection endpoint.

**How to apply:** Confirm native manifest identity, inspect all bundled entrypoints and SDK configuration, and trace relative URLs against the Capacitor origin. Treat each subsequent release independently. Static inspection establishes configured behavior, not an observed network capture; use device network inspection when runtime behavior remains ambiguous. Do not generalize Android findings to the website or iOS.