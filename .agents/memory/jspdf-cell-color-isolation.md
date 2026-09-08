---
name: jsPDF cell color isolation
description: Apple Files compatibility rule for table cells drawn directly with jsPDF.
---

Reapply the intended fill color immediately before drawing every table cell rectangle, then reapply the text color before drawing that cell's text.

**Why:** PDF fills and text share the non-stroking color state. Apple Files preserves the text color after one cell and may use it to fill the next cell, producing unreadable dark boxes when colors are set only once outside a cell loop.

**How to apply:** For any jsPDF table drawn with repeated `rect(..., "FD")` and `text(...)` calls, set the fill inside each cell iteration before `rect`, and set the text color after `rect` before `text`.