#!/usr/bin/env node
/**
 * Generate App Store screenshots from HTML source files.
 *
 * Prerequisites:
 *   - NixOS / Replit environment with nix-shell available
 *   - chromium available via nix-shell (nix-shell -p chromium)
 *
 * Usage:
 *   node generate-screenshots.js                   # regenerate all screenshots
 *   node generate-screenshots.js iphone            # iPhone set only (S1-S4)
 *   node generate-screenshots.js ipad              # iPad set only (iPad-S1–S4)
 *   node generate-screenshots.js s1                # slide 1 for both iPhone and iPad
 *   node generate-screenshots.js s2 s4             # slides 2 and 4 (both device sizes)
 *   node generate-screenshots.js --check-colors    # verify brand colors in all A-series HTML files
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

// ---------------------------------------------------------------------------
// Brand color utilities
// ---------------------------------------------------------------------------

/**
 * Canonical brand color table.
 *
 * These hex values are the authoritative brand palette.  They must stay in
 * sync with the HSL tokens in artifacts/jotrea/src/index.css (light mode :root).
 * If the CSS tokens change, update BOTH this table AND the index.css values.
 *
 * The check below reads the CSS and warns when the documented HSL no longer
 * rounds to within ±1 channel of these hex values, which catches silent drift.
 */
const BRAND_COLORS = [
  { name: 'primary (tan)',          token: '--primary',     hex: '#D4A574', hsl: [32,  55, 64] },
  { name: 'background',             token: '--background',  hex: '#FFFDF7', hsl: [40, 100, 98] },
  { name: 'foreground (navy)',       token: '--foreground',  hex: '#1A1D3D', hsl: [240, 39, 14] },
  { name: 'primary-dark (gradient)', token: '--primary-dark',hex: '#C4956A', hsl: null },
];

/**
 * Convert HSL (0–360, 0–100, 0–100) to an RGB triple [r, g, b] (0–255).
 */
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if      (h <  60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Parse a 6-digit hex string to [r, g, b]. */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Read the :root block from index.css and verify that each token's HSL value
 * is consistent with the documented canonical hex (within ±2 per channel).
 * Returns a list of warning strings (empty = all good).
 */
function checkCssDrift(cssPath) {
  const css       = fs.readFileSync(cssPath, 'utf8');
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/s);
  if (!rootMatch) return ['Could not find :root block in index.css'];

  const rootBlock = rootMatch[1];
  const warnings  = [];

  for (const { name, token, hex, hsl } of BRAND_COLORS) {
    if (!hsl) continue; // primary-dark is not a CSS variable

    const re = new RegExp(token + ':\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%');
    const m  = rootBlock.match(re);
    if (!m) {
      warnings.push(`${token} not found in :root`);
      continue;
    }
    const [, h, s, l] = m.map(Number);

    // Check if the documented canonical HSL matches what's in the file
    if (h !== hsl[0] || s !== hsl[1] || l !== hsl[2]) {
      const cssRgb = hslToRgb(h, s, l);
      const cssHex = '#' + cssRgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      warnings.push(
        `${token} (${name}): index.css has hsl(${h} ${s}% ${l}%) → ${cssHex}, ` +
        `but screenshots use canonical ${hex} — update HTML files or this table`
      );
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Ruler dark-mode contrast check
// ---------------------------------------------------------------------------

/**
 * Read the .dark block from index.css, extract --ruler-card-bg, and verify
 * the RGBA alpha is >= 0.85 (the fix value).  Returns a list of warning strings.
 */
function checkRulerContrast(cssPath) {
  const css = fs.readFileSync(cssPath, 'utf8');

  // Extract the .dark { … } block
  const darkMatch = css.match(/\.dark\s*\{([^}]+)\}/s);
  if (!darkMatch) return ['Could not find .dark block in index.css'];

  const darkBlock = darkMatch[1];
  const re = /--ruler-card-bg\s*:\s*rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i;
  const m  = darkBlock.match(re);
  if (!m) {
    return ['--ruler-card-bg not found (or not in rgba form) inside .dark block'];
  }

  const alpha = parseFloat(m[4]);
  if (alpha < 0.85) {
    return [
      `--ruler-card-bg alpha is ${alpha} (rgba(${m[1]},${m[2]},${m[3]},${m[4]})) — ` +
      `must be >= 0.85 for sufficient tick contrast in dark mode. ` +
      `Was reduced from 0.85 back toward 0.70?`
    ];
  }
  return [];
}

/**
 * Screenshot ruler-dark-mode-check.html and run the opacity guard.
 * When outPath already exists, a fresh copy is written alongside it as
 * ruler-dark-mode-check-latest.png so diffs are always available.
 */
function runRulerCheck(dir, cssPath) {
  console.log('\n── Ruler Dark-Mode Contrast Check ──────────────────────────\n');

  // ── 1. CSS opacity guard ────────────────────────────────────────────────────
  let opacityWarnings = [];
  try {
    opacityWarnings = checkRulerContrast(cssPath);
  } catch (err) {
    console.warn(`  ⚠  Could not read ${cssPath}: ${err.message}`);
  }

  if (opacityWarnings.length > 0) {
    console.log('  ✗  Ruler opacity check FAILED:');
    for (const w of opacityWarnings) console.log(`     • ${w}`);
  } else {
    console.log('  ✓  --ruler-card-bg alpha >= 0.85 in .dark block.');
  }

  // ── 2. Capture screenshot of the verification page ──────────────────────────
  const htmlFile = 'ruler-dark-mode-check.html';
  const htmlPath = path.join(dir, htmlFile);
  const refPath  = path.join(dir, 'ruler-dark-mode-ref.png');
  const latestPath = path.join(dir, 'ruler-dark-mode-check-latest.png');

  if (!fs.existsSync(htmlPath)) {
    console.warn(`  ⚠  ${htmlFile} not found — skipping screenshot capture.`);
  } else {
    // Always capture a fresh "latest" copy
    const captureTarget = fs.existsSync(refPath) ? latestPath : refPath;
    const cmd = [
      'nix-shell -p chromium --run',
      `"chromium --headless --no-sandbox --disable-gpu`,
      `--screenshot='${captureTarget}'`,
      `--window-size=900,900`,
      `'file://${htmlPath}'"`,
    ].join(' ');

    try {
      execSync(cmd, { stdio: 'inherit' });
      if (captureTarget === refPath) {
        console.log(`  ✓  Reference snapshot saved → ruler-dark-mode-ref.png`);
      } else {
        console.log(`  ✓  Latest snapshot saved   → ruler-dark-mode-check-latest.png`);
        console.log('     Diff against ruler-dark-mode-ref.png to spot regressions.');
      }
    } catch (err) {
      console.warn(`  ⚠  Screenshot capture failed: ${err.message}`);
    }
  }

  // ── 3. Final verdict ─────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  if (opacityWarnings.length > 0) {
    console.log('Ruler contrast check FAILED (see above).\n');
    process.exit(1);
  } else {
    console.log('Ruler contrast check PASSED.\n');
  }
}

/**
 * The 12 new A-series HTML files that must be checked.
 */
const A_SERIES_HTML = [
  'app-s1-dashboard-hero.html',
  'app-s2-dose-tracking.html',
  'app-s3-weight-progress.html',
  'app-s4-med-info.html',
  'app-s5-side-effects.html',
  'app-s6-personalized-plan.html',
  'ipad-app-s1-dashboard-hero.html',
  'ipad-app-s2-dose-tracking.html',
  'ipad-app-s3-weight-progress.html',
  'ipad-app-s4-med-info.html',
  'ipad-app-s5-side-effects.html',
  'ipad-app-s6-personalized-plan.html',
];

/**
 * Check that each A-series HTML file contains the expected brand hex values,
 * and that the canonical hex table still agrees with index.css.
 *
 * Prints a per-file, per-token report and exits 1 if any check fails.
 *
 * @param {string} dir      Directory containing the HTML files
 * @param {string} cssPath  Absolute path to index.css
 */
function runColorCheck(dir, cssPath) {
  console.log('\n── Brand Color Check ────────────────────────────────────────\n');

  // ── 1. Drift check: warn if index.css no longer matches the canonical table ─
  let driftWarnings = [];
  try {
    driftWarnings = checkCssDrift(cssPath);
  } catch (err) {
    console.warn(`  ⚠  Could not read ${cssPath}: ${err.message}`);
  }

  console.log('Canonical brand palette (must match artifacts/jotrea/src/index.css):');
  for (const { name, token, hex, hsl } of BRAND_COLORS) {
    const hslLabel = hsl ? `hsl(${hsl[0]} ${hsl[1]}% ${hsl[2]}%)` : 'hardcoded (no CSS var)';
    console.log(`  ${token.padEnd(22)} ${hex}  ${hslLabel}  (${name})`);
  }

  if (driftWarnings.length > 0) {
    console.log('\n  ⚠  CSS drift detected — index.css no longer matches the canonical table:');
    for (const w of driftWarnings) console.log(`     • ${w}`);
  } else {
    console.log('\n  ✓  index.css tokens agree with canonical hex values.');
  }
  console.log();

  // ── 2. Per-file check: every A-series HTML must contain each brand hex ──────
  let filesPassed = 0;
  let filesFailed = 0;

  for (const htmlFile of A_SERIES_HTML) {
    const htmlPath = path.join(dir, htmlFile);
    if (!fs.existsSync(htmlPath)) {
      console.log(`SKIP  ${htmlFile} — file not found`);
      continue;
    }

    const content = fs.readFileSync(htmlPath, 'utf8').toUpperCase();
    const missing = [];

    for (const { name, hex } of BRAND_COLORS) {
      if (!content.includes(hex.replace('#', '').toUpperCase())) {
        missing.push(`${hex} (${name})`);
      }
    }

    if (missing.length === 0) {
      console.log(`  ✓  ${htmlFile}`);
      filesPassed++;
    } else {
      console.log(`  ✗  ${htmlFile}`);
      for (const m of missing) console.log(`       MISSING: ${m}`);
      filesFailed++;
    }
  }

  // ── 3. Final verdict ─────────────────────────────────────────────────────────
  const overallFail = filesFailed > 0 || driftWarnings.length > 0;
  console.log('\n' + '─'.repeat(60));
  if (!overallFail) {
    console.log(`Brand color check PASSED — all ${filesPassed} A-series files use correct hex values.\n`);
  } else {
    if (filesFailed > 0) {
      console.log(`Brand color check FAILED — ${filesFailed} file(s) have color mismatches (see above).`);
      console.log('Fix: update the HTML files to use the canonical hex values listed above.\n');
    }
    if (driftWarnings.length > 0) {
      console.log('Brand color check FAILED — index.css palette has drifted from screenshots.');
      console.log('Fix: update BRAND_COLORS in generate-screenshots.js AND the A-series HTML files.\n');
    }
    process.exit(1);
  }
}

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
  node generate-screenshots.js --check-colors    Verify brand hex values in all 12 A-series HTML files
  node generate-screenshots.js --check-ruler     Verify ruler dark-mode contrast (opacity guard + snapshot)
  node generate-screenshots.js --help            Print this usage message
`);
  process.exit(0);
}

// --check-colors: standalone brand color spot-check (no screenshot generation)
if (args.includes('--check-colors')) {
  const cssPath = path.resolve(__dirname, '../../artifacts/jotrea/src/index.css');
  runColorCheck(DIR, cssPath);
  process.exit(0);
}

// --check-ruler: standalone ruler dark-mode contrast check
if (args.includes('--check-ruler')) {
  const cssPath = path.resolve(__dirname, '../../artifacts/jotrea/src/index.css');
  runRulerCheck(DIR, cssPath);
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

const cssPath = path.resolve(__dirname, '../../artifacts/jotrea/src/index.css');

// ---------------------------------------------------------------------------
// Automatic brand-color check when any A-series job was in the run
// ---------------------------------------------------------------------------
const hasASeriesJob = jobs.some(job => /^(a[1-6]|ia[1-6])$/.test(job.id));
if (hasASeriesJob) {
  runColorCheck(DIR, cssPath);
}

// ---------------------------------------------------------------------------
// Automatic ruler dark-mode contrast check on every full run
// (also runs whenever s2 / goal-weight slides are included)
// ---------------------------------------------------------------------------
const isFullRun  = process.argv.slice(2).filter(a => !a.startsWith('--')).length === 0;
const hasGoalJob = jobs.some(job => job.html.includes('goal-weight'));
if (isFullRun || hasGoalJob) {
  runRulerCheck(DIR, cssPath);
}
