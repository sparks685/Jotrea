---
name: jsPDF cell color isolation
description: Apple Files compatibility rule for table cells drawn directly with jsPDF.
---

Draw every table cell background in a row before drawing any text in that row. Keep shape drawing and text drawing in separate passes.

**Why:** PDF fills and text share the non-stroking color state. Apple Files preserves the text color after one cell and may use it to fill the next cell. Reapplying the same fill through jsPDF may still be optimized away because jsPDF tracks fill and text colors separately, so alternating rectangle/text calls can produce unreadable dark boxes.

**How to apply:** For any jsPDF table, first loop through the row to draw all `rect(..., "FD")` cells, then set the text color and use a second loop to draw all cell text.

This two-pass drawing order was confirmed readable in Apple Files on a physical iPhone.