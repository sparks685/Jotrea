#!/usr/bin/env node
/**
 * Generate App Store screenshots from HTML source files.
 *
 * Prerequisites:
 *   - NixOS / Replit environment with nix-shell available
 *   - chromium available via nix-shell (nix-shell -p chromium)
 *
 * Usage:
 *   node generate-screenshots.js                   # regenerate all 8 screenshots
 *   node generate-screenshots.js iphone            # iPhone set only (S1-S4)
 *   node generate-screenshots.js ipad              # iPad set only (iPad-S1–S4)
 *   node generate-screenshots.js s1                # slide 1 for both iPhone and iPad
 *   node generate-screenshots.js s2 s4             # slides 2 and 4 (both device sizes)
 *   node generate-screenshots.js --help            # print this usage
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
 *     ipad-s1-onboarding.html              → Jotrea-iPad-S1.png
 *     ipad-s2-goal-weight.html             → Jotrea-iPad-S2.png
 *     ipad-s3-dashboard.html               → Jotrea-iPad-S3.png
 *     ipad-s4-weight-tracker.html          → Jotrea-iPad-S4.png
 *     ipad-app-s1-dashboard-hero.html      → Jotrea-iPad-App-S1.png
 *     ipad-app-s2-dose-tracking.html       → Jotrea-iPad-App-S2.png
 *     ipad-app-s3-weight-progress.html     → Jotrea-iPad-App-S3.png
 *     ipad-app-s4-med-info.html            → Jotrea-iPad-App-S4.png
 *     ipad-app-s5-side-effects.html        → Jotrea-iPad-App-S5.png
 *     ipad-app-s6-personalized-plan.html   → Jotrea-iPad-App-S6.png
 *
 * Brand colors (keep these in sync with artifacts/jotrea/src/index.css):
 *   --primary (tan):    #D4A574  (hsl 32 55% 64%)
 *   --background:       #FFFDF7  (hsl 40 100% 98%)
 *   --foreground (navy):#1A1D3D  (hsl 240 39% 14%)
 *   --primary-dark:     #C4956A  (darker tan, used in gradients)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DIR = path.resolve(__dirname);

/** All canonical App Store screenshot jobs. */
const ALL_JOBS = [
  // ── Original set (S1–S4) ───────────────────────────────────────────────────
  { id: 's1', device: 'iphone', html: 's1-onboarding.html',         out: 'Jotrea-S1.png',      w: 1290, h: 2796 },
  { id: 's2', device: 'iphone', html: 's2-goal-weight.html',         out: 'Jotrea-S2.png',      w: 1290, h: 2796 },
  { id: 's3', device: 'iphone', html: 's3-dashboard.html',           out: 'Jotrea-S3.png',      w: 1290, h: 2796 },
  { id: 's4', device: 'iphone', html: 's4-weight-tracker.html',      out: 'Jotrea-S4.png',      w: 1290, h: 2796 },
  { id: 's1', device: 'ipad',   html: 'ipad-s1-onboarding.html',     out: 'Jotrea-iPad-S1.png', w: 2064, h: 2752 },
  { id: 's2', device: 'ipad',   html: 'ipad-s2-goal-weight.html',    out: 'Jotrea-iPad-S2.png', w: 2064, h: 2752 },
  { id: 's3', device: 'ipad',   html: 'ipad-s3-dashboard.html',      out: 'Jotrea-iPad-S3.png', w: 2064, h: 2752 },
  { id: 's4', device: 'ipad',   html: 'ipad-s4-weight-tracker.html', out: 'Jotrea-iPad-S4.png', w: 2064, h: 2752 },
  // ── App Store marketing set (A1–A6) ────────────────────────────────────────
  { id: 'a1', device: 'iphone', html: 'app-s1-dashboard-hero.html',          out: 'Jotrea-App-S1.png',      w: 1290, h: 2796 },
  { id: 'a2', device: 'iphone', html: 'app-s2-dose-tracking.html',           out: 'Jotrea-App-S2.png',      w: 1290, h: 2796 },
  { id: 'a3', device: 'iphone', html: 'app-s3-weight-progress.html',         out: 'Jotrea-App-S3.png',      w: 1290, h: 2796 },
  { id: 'a4', device: 'iphone', html: 'app-s4-med-info.html',                out: 'Jotrea-App-S4.png',      w: 1290, h: 2796 },
  { id: 'a5', device: 'iphone', html: 'app-s5-side-effects.html',            out: 'Jotrea-App-S5.png',      w: 1290, h: 2796 },
  { id: 'a6', device: 'iphone', html: 'app-s6-personalized-plan.html',       out: 'Jotrea-App-S6.png',      w: 1290, h: 2796 },
  { id: 'ia1', device: 'ipad',  html: 'ipad-app-s1-dashboard-hero.html',     out: 'Jotrea-iPad-App-S1.png', w: 2064, h: 2752 },
  { id: 'ia2', device: 'ipad',  html: 'ipad-app-s2-dose-tracking.html',      out: 'Jotrea-iPad-App-S2.png', w: 2064, h: 2752 },
  { id: 'ia3', device: 'ipad',  html: 'ipad-app-s3-weight-progress.html',    out: 'Jotrea-iPad-App-S3.png', w: 2064, h: 2752 },
  { id: 'ia4', device: 'ipad',  html: 'ipad-app-s4-med-info.html',           out: 'Jotrea-iPad-App-S4.png', w: 2064, h: 2752 },
  { id: 'ia5', device: 'ipad',  html: 'ipad-app-s5-side-effects.html',       out: 'Jotrea-iPad-App-S5.png', w: 2064, h: 2752 },
  { id: 'ia6', device: 'ipad',  html: 'ipad-app-s6-personalized-plan.html',  out: 'Jotrea-iPad-App-S6.png', w: 2064, h: 2752 },
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2).map(a => a.toLowerCase());

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage:
  node generate-screenshots.js                   Regenerate all screenshots
  node generate-screenshots.js iphone            iPhone set only (S1-S4)
  node generate-screenshots.js ipad              iPad set only (iPad-S1–S4)
  node generate-screenshots.js s1                Slide 1 for both device sizes
  node generate-screenshots.js s2 s4             Slides 2 and 4 for both device sizes
  node generate-screenshots.js iphone s1         Specific device + slide combo
  node generate-screenshots.js --marketing       iPhone App Store marketing set (A1–A6)
  node generate-screenshots.js --marketing ipad  iPad App Store marketing set (iPad-App-S1–S6)
  node generate-screenshots.js --help            Print this usage message
`);
  process.exit(0);
}

function selectJobs(args) {
  const marketing = args.includes('--marketing');

  // Strip flag tokens before further processing
  const positional = args.filter(a => !a.startsWith('--'));

  if (marketing) {
    const deviceFilters = positional.filter(a => a === 'iphone' || a === 'ipad');
    const unknown       = positional.filter(a => a !== 'iphone' && a !== 'ipad');

    if (unknown.length > 0) {
      console.error(`Unknown filter(s) for --marketing: ${unknown.join(', ')}`);
      console.error('Valid device filters with --marketing: iphone (default), ipad');
      process.exit(1);
    }

    // Default to iphone when no device filter is given with --marketing
    const devices = deviceFilters.length > 0 ? deviceFilters : ['iphone'];

    return ALL_JOBS.filter(job => {
      const isMarketingSlide = /^(a[1-6]|ia[1-6])$/.test(job.id);
      return isMarketingSlide && devices.includes(job.device);
    });
  }

  if (positional.length === 0) return ALL_JOBS;

  const deviceFilters = positional.filter(a => a === 'iphone' || a === 'ipad');
  const slideFilters  = positional.filter(a => /^(s[1-4]|a[1-6]|ia[1-6])$/.test(a));
  const unknown       = positional.filter(a => !deviceFilters.includes(a) && !slideFilters.includes(a));

  if (unknown.length > 0) {
    console.error(`Unknown filter(s): ${unknown.join(', ')}`);
    console.error('Valid device filters: iphone, ipad');
    console.error('Valid slide filters:  s1–s4, a1–a6, ia1–ia6');
    process.exit(1);
  }

  return ALL_JOBS.filter(job => {
    const deviceMatch = deviceFilters.length === 0 || deviceFilters.includes(job.device);
    const slideMatch  = slideFilters.length  === 0 || slideFilters.includes(job.id);
    return deviceMatch && slideMatch;
  });
}

const jobs = selectJobs(args);

if (jobs.length === 0) {
  console.warn('No jobs matched the given filters. Nothing to do.');
  process.exit(0);
}

console.log(`\nGenerating ${jobs.length} screenshot(s)…\n`);

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

for (const job of jobs) {
  const htmlPath = path.join(DIR, job.html);
  if (!fs.existsSync(htmlPath)) {
    console.warn(`SKIP  ${job.html} — file not found`);
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
    const size = fs.statSync(outPath).size;
    console.log(`  ✓ ${job.out}  (${(size / 1024).toFixed(0)} KB)\n`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${job.out} failed: ${err.message}\n`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('─'.repeat(48));
console.log(`Done.  ${passed} succeeded, ${failed} failed.`);
if (failed > 0) process.exit(1);
