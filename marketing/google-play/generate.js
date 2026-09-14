#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const DIR = __dirname;
const RAW_DIR = path.join(DIR, 'raw');

const SLIDES = [
  { index: 1, title: 'Dashboard', out: '01-Dashboard.png', html: '01-dashboard.html' },
  { index: 2, title: 'Dose History', out: '02-Dose-History.png', html: '02-dose-history.html' },
  { index: 3, title: 'Weight', out: '03-Weight.png', html: '03-weight.html' },
  { index: 4, title: 'Symptoms', out: '04-Symptoms.png', html: '04-symptoms.html' },
  { index: 5, title: 'Cabinet', out: '05-Cabinet.png', html: '05-cabinet.html' },
  { index: 6, title: 'Provider Summary', out: '06-Provider-Summary.png', html: '06-provider-summary.html' },
  { index: 7, title: 'Visit Notes', out: '07-Visit-Notes.png', html: '07-visit-notes.html' },
  { index: 8, title: 'Exports', out: '08-Exports.png', html: '08-exports.html' },
];

function findRawImageForSlide(slideIndex) {
  if (!fs.existsSync(RAW_DIR)) return null;
  const files = fs.readdirSync(RAW_DIR);
  const prefix = String(slideIndex).padStart(2, '0');
  const matched = files.find(f => f.startsWith(prefix) && f.endsWith('.png'));
  if (matched) return path.join(RAW_DIR, matched);
  const pngs = files.filter(f => f.endsWith('.png')).sort();
  if (pngs.length >= slideIndex) {
    return path.join(RAW_DIR, pngs[slideIndex - 1]);
  }
  return null;
}

let passed = 0;
let failed = 0;

console.log('Generating Google Play screenshots...\n');

for (const slide of SLIDES) {
  const rawImage = findRawImageForSlide(slide.index);
  if (!rawImage) {
    console.error(`No raw image found for slide ${slide.index} (${slide.title}).`);
    failed++;
    continue;
  }
  
  const htmlPath = path.join(DIR, slide.html);
  if (!fs.existsSync(htmlPath)) {
    console.error(`[✗] Template ${slide.html} not found.`);
    failed++;
    continue;
  }
  
  let htmlContent = fs.readFileSync(htmlPath, 'utf8');
  
  if (rawImage) {
    const rawUrl = 'file://' + rawImage;
    htmlContent = htmlContent.replace('__RAW_IMAGE_URL__', rawUrl);
  } else {
    // 1x1 transparent placeholder so the render doesn't show a broken image icon
    htmlContent = htmlContent.replace('__RAW_IMAGE_URL__', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  }

  const tempHtml = path.join(DIR, `temp-${slide.html}`);
  fs.writeFileSync(tempHtml, htmlContent);

  const outPath = path.join(DIR, slide.out);
  
  try {
    const captureCmd = [
      `chromium --headless --no-sandbox --disable-gpu`,
      `--screenshot='${outPath}'`,
      `--window-size=1080,1920`,
      `'file://${tempHtml}'`
    ].join(' ');
    
    // suppress chromium stdout
    execSync(captureCmd, { stdio: ['ignore', 'ignore', 'pipe'] });
    
    // Remove alpha channel to satisfy Google Play 24-bit PNG requirement
    const magickCmd = `magick "${outPath}" -alpha off -strip "${outPath}"`;
    execSync(magickCmd, { stdio: 'pipe' });
    
    const size = fs.statSync(outPath).size;
    console.log(`[✓] Created ${slide.out} - ${(size / 1024).toFixed(0)} KB`);
    passed++;
  } catch (err) {
    // Try nix-shell if chromium fails natively (in case it needs the wrapper)
    try {
      const fallbackCmd = [
        `nix-shell -p chromium --run`,
        `"chromium --headless --no-sandbox --disable-gpu`,
        `--screenshot='${outPath}'`,
        `--window-size=1080,1920`,
        `'file://${tempHtml}'"`
      ].join(' ');
      execSync(fallbackCmd, { stdio: ['ignore', 'ignore', 'pipe'] });
      
      const magickCmd = `magick "${outPath}" -alpha off -strip "${outPath}"`;
      execSync(magickCmd, { stdio: 'pipe' });
      
      const size = fs.statSync(outPath).size;
      console.log(`[✓] Created ${slide.out} (via fallback) - ${(size / 1024).toFixed(0)} KB`);
      passed++;
    } catch (fallbackErr) {
      console.error(`[✗] Failed to generate ${slide.out}`);
      failed++;
    }
  } finally {
    if (fs.existsSync(tempHtml)) {
      fs.unlinkSync(tempHtml);
    }
  }
}

console.log(`\nDone. ${passed} succeeded, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
