---
name: Store capture provenance
description: Keep store-listing captures grounded in real UI and distinguish browser captures from native verification.
---

Use actual rendered shared-app UI rather than redrawing simplified screens for store screenshots. Browser platform shims can expose platform-specific presentation for isolated marketing captures, but do not establish that the submitted native bundle looks or behaves identically.

**Why:** Existing Apple marketing compositions were simplified HTML, while the Google Play guidelines supplied by the user call for footage of the app itself. The development proxy can also inject a blue banner into otherwise valid captures.

**How to apply:** State capture provenance, use fictional data in isolated browser storage, inspect every output for injected preview banners, and never treat marketing capture success as physical Android verification.