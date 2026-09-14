# Google Play Screenshots for Jotrea

This directory contains the reproducible generator and HTML composition templates for the Jotrea Google Play Store screenshots.

The screenshots use a 1080x1920 (9:16) aspect ratio, NO alpha channel (24-bit PNG), and are heavily focused on the core UI, per Google Play's guidelines.

## Capture provenance

These are browser-rendered captures of the current shared React app, using fictional local demo records in an isolated Chromium session. An Android platform shim is used for Plus-gated screens. They are not physical Android device captures or a runtime verification of the submitted Android bundle. No app source, native projects, Apple marketing images, real subscription records, or reviewer credentials were changed.

Only the injected development-host banner is removed from the captures; the app UI is not redrawn. The final four compositions identify subscription-required Jotrea Plus features. Meeting the screenshot count and dimensions does not guarantee Google Play promotion.

## Prerequisites

1. Place the 8 raw UI captures in `marketing/google-play/raw/`.
   - Name them `01-dashboard.png` through `08-exports.png` (or any naming scheme as long as they begin with the correct `01` to `08` prefix).
2. Execute the generator.

## Usage

Run the generator script to compile the HTML templates into the final PNG assets. Chromium and ImageMagick (`magick`) are used to render and strip alpha channels.

```bash
./generate.js
```

## Generated Files & Recommended Order

Upload the generated screenshots to the Google Play Console in this exact order. Below are the recommended alt text descriptions (<= 140 characters) for each.

| # | Filename                  | Alt Text (<= 140 characters) |
|---|---------------------------|------------------------------|
| 1 | `01-Dashboard.png`        | The Jotrea dashboard showing medication routine, goals, and daily progress. |
| 2 | `02-Dose-History.png`     | Jotrea Dose Log showing recorded doses and a chart of reported side effects. |
| 3 | `03-Weight.png`           | A line chart tracking weight progress toward the goal weight. |
| 4 | `04-Symptoms.png`         | The Symptoms tracker screen for logging side effects and well-being. |
| 5 | `05-Cabinet.png`          | Jotrea Plus Medication History & Context showing the current tracker, reminder times, and previous trackers. |
| 6 | `06-Provider-Summary.png` | A concise summary of health data formatted for sharing with a doctor. |
| 7 | `07-Visit-Notes.png`      | A digital notepad screen for preparing questions before a doctor visit. |
| 8 | `08-Exports.png`          | Jotrea Plus Export & Share settings with PDF report sharing and CSV export options. |

## Maintenance

If you need to update taglines or adjust colors, modify the corresponding `0X-*.html` file or `styles.css` and re-run `./generate.js`.
