// Android-only exports of the existing onboarding welcome tile in Onboarding.tsx:
// #e8b989 -> #D4A574, rounded-[28px] / w-24, white Lucide Syringe (42px, 1.8).
// Generation/preview requires ImageMagick (magick); --check only requires Node.
// Never reads or writes the iOS asset catalog.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const res = fileURLToPath(new URL("../android/app/src/main/res/", import.meta.url));
const recipe = fileURLToPath(import.meta.url);
const manifestPath = fileURLToPath(new URL("./android-branding-assets.json", import.meta.url));
const verify = process.argv.includes("--check");
const preview = process.argv.includes("--preview");
const exported = [];
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function pngInfo(relative) {
  const png = readFileSync(join(res, relative));
  if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      png.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${relative} is not a PNG with a valid IHDR`);
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), sha256: sha256(png) };
}

// Enumerating these, rather than trusting the manifest's asset list, catches
// missing density/orientation/fallback files even if the manifest is incomplete.
const expected = {};
for (const [density, factor] of Object.entries(densities)) {
  for (const name of ["ic_launcher", "ic_launcher_round"]) {
    expected[`mipmap-${density}/${name}.png`] = [48 * factor, 48 * factor];
  }
  expected[`mipmap-${density}/ic_launcher_foreground.png`] = [108 * factor, 108 * factor];
  expected[`drawable-port-${density}/splash.png`] = [480 * factor, 800 * factor];
  expected[`drawable-land-${density}/splash.png`] = [800 * factor, 480 * factor];
}
expected["drawable/splash.png"] = [480, 320];
expected["drawable-nodpi/jotrea_splash_icon.png"] = [288, 288];

if (verify) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.recipeSha256 !== sha256(readFileSync(recipe))) {
    throw new Error("Android branding recipe changed; regenerate assets and manifest with node scripts/generate-android-branding.mjs");
  }
  const files = Object.keys(expected).sort();
  if (JSON.stringify(Object.keys(manifest.assets).sort()) !== JSON.stringify(files)) {
    throw new Error("Android branding manifest is missing an expected launcher/splash density");
  }
  for (const relative of files) {
    const info = pngInfo(relative);
    if (info.width !== expected[relative][0] || info.height !== expected[relative][1] ||
        JSON.stringify(info) !== JSON.stringify(manifest.assets[relative])) {
      throw new Error(`${relative} has incorrect dimensions or differs from the branded asset manifest`);
    }
  }
  console.log(`Verified ${files.length} Android branded PNGs (Node-only SHA-256 and dimensions)`);
  process.exit(0);
}

// Deliberately only created in generation mode, never in routine tests.
const temp = mkdtempSync(join(tmpdir(), "jotrea-android-brand-"));

// Exact path data from lucide-react's Syringe component (ISC), with the same
// stroke width and line caps as the 42px onboarding instance.
const paths = [
  "m18 2 4 4", "m17 7 3-3",
  "M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5",
  "m9 11 4 4", "m5 19-3 3", "m14 4 6 6",
];
const syringe = (x, y, scale) =>
  `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths.map((d) => `<path d="${d}"/>`).join("")}</g>`;
const gradient = `<defs><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#e8b989"/><stop offset="100%" stop-color="#D4A574"/></linearGradient></defs>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gradient}${body}</svg>`;
const tile = (x, y, size, radius = size * 28 / 96) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="url(#gold)"/>${syringe(x + size * 27 / 96, y + size * 27 / 96, size * 42 / (96 * 24))}`;

function render(relative, w, h, content) {
  const destination = join(res, relative);
  mkdirSync(join(destination, ".."), { recursive: true });
  const result = spawnSync("magick", ["-background", "none", "svg:-", "-strip", `PNG32:${destination}`], {
    input: svg(w, h, content), encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`ImageMagick failed for ${relative}: ${result.stderr || result.error}`);
  exported.push(relative);
}

try {
  for (const [density, factor] of Object.entries(densities)) {
    const legacy = 48 * factor;
    const adaptive = 108 * factor;
    render(`mipmap-${density}/ic_launcher.png`, legacy, legacy,
      tile(0, 0, legacy));
    render(`mipmap-${density}/ic_launcher_round.png`, legacy, legacy,
      `<circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="url(#gold)"/>${syringe(legacy * 27 / 96, legacy * 27 / 96, legacy * 42 / (96 * 24))}`);
    render(`mipmap-${density}/ic_launcher_foreground.png`, adaptive, adaptive,
      syringe(adaptive * 33 / 108, adaptive * 33 / 108, adaptive * 42 / (108 * 24)));
    for (const [orientation, w, h] of [["port", 480, 800], ["land", 800, 480]]) {
      const width = Math.round(w * factor);
      const height = Math.round(h * factor);
      const mark = 96 * factor;
      render(`drawable-${orientation}-${density}/splash.png`, width, height,
        `<rect width="${width}" height="${height}" fill="#FFFCF5"/>${tile((width - mark) / 2, (height - mark) / 2, mark)}`);
    }
  }
  render("drawable/splash.png", 480, 320,
    `<rect width="480" height="320" fill="#FFFCF5"/>${tile(192, 112, 96)}`);
  // Android 12+ splash icon canvas: 288dp with content centered safely inside
  // the 192dp system mask. This is an icon, never a full-screen bitmap.
  render("drawable-nodpi/jotrea_splash_icon.png", 288, 288, tile(90, 90, 108));
  const files = Object.keys(expected).sort();
  if (JSON.stringify(exported.slice().sort()) !== JSON.stringify(files)) {
    throw new Error("Generator did not export every expected Android branding asset");
  }
  const assets = Object.fromEntries(files.map((relative) => [relative, pngInfo(relative)]));
  writeFileSync(manifestPath, `${JSON.stringify({ recipeSha256: sha256(readFileSync(recipe)), assets }, null, 2)}\n`);
  if (preview && !verify) {
    const output = fileURLToPath(new URL("../../../.local/verification/android-branding.png", import.meta.url));
    mkdirSync(join(output, ".."), { recursive: true });
    const masked = join(temp, "adaptive-preview.png");
    const maskedResult = spawnSync("magick", [
      join(res, "mipmap-xxxhdpi/ic_launcher_foreground.png"),
      "-background", "#D4A574", "-alpha", "remove", "-alpha", "off",
      "(", "-size", "432x432", "xc:none", "-fill", "white", "-draw", "circle 216,216 216,0", ")",
      "-alpha", "off", "-compose", "CopyOpacity", "-composite", masked,
    ], { encoding: "utf8" });
    if (maskedResult.status !== 0) throw new Error(`Adaptive preview failed: ${maskedResult.stderr || maskedResult.error}`);
    const command = [
      "magick", "montage", "-background", "#FFFCF5",
      "-font", "DejaVu-Sans", "-fill", "#283e34", "-pointsize", "18",
      "-label", "Launcher square", join(res, "mipmap-xxxhdpi/ic_launcher.png"),
      "-label", "Launcher round", join(res, "mipmap-xxxhdpi/ic_launcher_round.png"),
      "-label", "Adaptive circle mask", masked,
      "-label", "Android 12 splash", join(res, "drawable-nodpi/jotrea_splash_icon.png"),
      "-label", "Legacy portrait splash", join(res, "drawable-port-mdpi/splash.png"),
      "-label", "Legacy landscape splash", join(res, "drawable-land-mdpi/splash.png"),
      "-thumbnail", "320x240", "-gravity", "center", "-background", "#FFFCF5",
      "-tile", "3x2", "-geometry", "330x280+12+12", output,
    ];
    const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Preview failed: ${result.stderr || result.error}`);
    console.log(`Contact sheet: ${output}`);
  }
  console.log(`Generated ${exported.length} Android branded PNGs and SHA-256 manifest`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}