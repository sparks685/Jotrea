---
name: Interruption-safe draft saves
description: Reliability rule for sensitive drafts in the iPhone webview when iOS suspends the app before a debounce completes.
---

Debounced autosave is not sufficient for sensitive native-app drafts. Keep a live ref updated in the same input event and synchronously persist it on blur, `visibilitychange` to hidden, `pagehide`, explicit navigation, and unmount. The write must upsert by stable record ID.

**Why:** iOS can suspend or terminate the webview before a pending timer or React render runs. A stable-ID upsert preserves the latest draft without creating duplicates.

**How to apply:** Use this pattern for editable, locally persisted forms where losing the last keystrokes would matter. Opening an untouched new form must not create an empty record.