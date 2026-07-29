#!/usr/bin/env node
/**
 * Generate App Store screenshots from HTML source files.
 *
 * Prerequisites:
 *   - NixOS / Replit environment with nix-shell available
 *   - chromium available via nix-shell (nix-shell -p chromium)
 *
 * Usage:
 *   node generate-screenshots.js
 *
 * Or run manually for a single file:
 *   nix-shell -p chromium --run "chromium --headless --no-sandbox --disable-gpu \
 *     --screenshot='marketing/screenshots/Jotrea-S1.png' \
 *     --window-size=1290,2796 \
 *     'file:///abs/path/to/marketing/screenshots/s1-onboarding.html'"
 *
 * Sources → Outputs:
 *   iPhone 6.7" (1290×2796):
 *     s1-onboarding.html     → Jotrea-S1.png   (Welcome screen)
 *     s2-goal-weight.html    → Jotrea-S2.png   (Goal Weight ruler)
 *     s3-dashboard.html      → Jotrea-S3.png   (Dashboard)
 *     s4-weight-tracker.html → Jotrea-S4.png   (Weight Tracker)
 *
 *   iPad 11" (2064×2752):
 *     ipad-s1-onboarding.html     → Jotrea-iPad-S1.png
 *     ipad-s2-goal-weight.html    → Jotrea-iPad-S2.png
 *     ipad-s3-dashboard.html      → Jotrea-iPad-S3.png
 *     ipad-s4-weight-tracker.html → Jotrea-iPad-S4.png
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname);

const jobs = [
  { html: 's1-onboarding.html',         out: 'Jotrea-S1.png',      w: 1290, h: 2796 },
  { html: 's2-goal-weight.html',         out: 'Jotrea-S2.png',      w: 1290, h: 2796 },
  { html: 's3-dashboard.html',           out: 'Jotrea-S3.png',      w: 1290, h: 2796 },
  { html: 's4-weight-tracker.html',      out: 'Jotrea-S4.png',      w: 1290, h: 2796 },
  { html: 'ipad-s1-onboarding.html',     out: 'Jotrea-iPad-S1.png', w: 2064, h: 2752 },
  { html: 'ipad-s2-goal-weight.html',    out: 'Jotrea-iPad-S2.png', w: 2064, h: 2752 },
  { html: 'ipad-s3-dashboard.html',      out: 'Jotrea-iPad-S3.png', w: 2064, h: 2752 },
  { html: 'ipad-s4-weight-tracker.html', out: 'Jotrea-iPad-S4.png', w: 2064, h: 2752 },
];

for (const job of jobs) {
  const htmlPath = path.join(DIR, job.html);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`SKIP  ${job.html} — not found`);
    continue;
  }
  const outPath = path.join(DIR, job.out);
  const cmd = [
    'nix-shell -p chromium --run',
    `"chromium --headless --no-sandbox --disable-gpu`,
    `--screenshot='${outPath}'`,
    `--window-size=${job.w},${job.h}`,
    `'file://${htmlPath}'"`,
  ].join(' ');

  console.log(`→ ${job.html}  (${job.w}×${job.h})`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`  ✓ ${job.out}`);
  } catch (err) {
    console.error(`  ✗ ${job.out} failed:`, err.message);
  }
}

console.log('Done.');
