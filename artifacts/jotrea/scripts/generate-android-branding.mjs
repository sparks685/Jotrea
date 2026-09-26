// Exports from branding/jotrea-approved-icon.png, the user's approved original
// artwork (gold syringe/ring, green leaves, JOTREA wordmark and cream tile).
// Generation/preview needs ImageMagick; --check needs only Node. iOS is untouched.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("../branding/jotrea-approved-icon.png", import.meta.url));
const res = fileURLToPath(new URL("../android/app/src/main/res/", import.meta.url));
const recipe = fileURLToPath(import.meta.url);
const manifestPath = fileURLToPath(new URL("./android-branding-assets.json", import.meta.url));
const verify = process.argv.includes("--check");
const preview = process.argv.includes("--preview");
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function pngInfo(path) {
  const png = readFileSync(path);
  if (png.length < 24 || !png.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) ||
      png.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`${path} is not a PNG with a valid IHDR`);
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20), sha256: sha256(png) };
}

// Launcher foreground: 64dp source tile centered on 108dp transparent canvas.
// In a 66dp-diameter circular adaptive safe zone, the ring, leaves and wordmark
// stay inside the mask (the tile's outside corners may be clipped by the OS).
// Android 12 icon: 128dp source tile centered on a 288dp transparent canvas,
// fitting inside the system's 192dp diameter mask without clipped artwork.
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
const files = Object.keys(expected).sort();

if (verify) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.recipeSha256 !== sha256(readFileSync(recipe)) ||
      JSON.stringify(manifest.source) !== JSON.stringify(pngInfo(source))) {
    throw new Error("Approved source or Android branding recipe changed; regenerate assets and manifest");
  }
  if (JSON.stringify(Object.keys(manifest.assets).sort()) !== JSON.stringify(files)) {
    throw new Error("Android branding manifest is missing an expected launcher/splash density");
  }
  for (const relative of files) {
    const info = pngInfo(join(res, relative));
    if (info.width !== expected[relative][0] || info.height !== expected[relative][1] ||
        JSON.stringify(info) !== JSON.stringify(manifest.assets[relative])) {
      throw new Error(`${relative} has incorrect dimensions or differs from the approved asset manifest`);
    }
  }
  console.log(`Verified ${files.length} approved Android branded PNGs (Node-only SHA-256 and dimensions)`);
  process.exit(0);
}

const temp = mkdtempSync(join(tmpdir(), "jotrea-android-brand-"));
const exported = [];
function render(relative, args) {
  const output = join(res, relative);
  mkdirSync(join(output, ".."), { recursive: true });
  const result = spawnSync("magick", [source, ...args, "-strip", `PNG32:${output}`], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`ImageMagick failed for ${relative}: ${result.stderr || result.error}`);
  exported.push(relative);
}
const centered = (w, h, size, background) => [
  "-resize", `${size}x${size}!`,
  "-background", background, "-gravity", "center", "-extent", `${w}x${h}`,
];

try {
  for (const [density, factor] of Object.entries(densities)) {
    const legacy = 48 * factor;
    const adaptive = 108 * factor;
    render(`mipmap-${density}/ic_launcher.png`, ["-resize", `${legacy}x${legacy}!`]);
    // Legacy round resource: only clip the original tile's outer corners; the
    // ring, green leaves, syringe and full wordmark remain within the circle.
    render(`mipmap-${density}/ic_launcher_round.png`, [
      "-resize", `${legacy}x${legacy}!`,
      "(", "-size", `${legacy}x${legacy}`, "xc:none", "-fill", "white",
      "-draw", `circle ${legacy / 2},${legacy / 2} ${legacy / 2},0`, ")",
      "-alpha", "off", "-compose", "CopyOpacity", "-composite",
    ]);
    render(`mipmap-${density}/ic_launcher_foreground.png`,
      centered(adaptive, adaptive, 64 * factor, "none"));
    for (const [orientation, w, h] of [["port", 480, 800], ["land", 800, 480]]) {
      render(`drawable-${orientation}-${density}/splash.png`,
        centered(w * factor, h * factor, 180 * factor, "#FFFCF5"));
    }
  }
  render("drawable/splash.png", centered(480, 320, 144, "#FFFCF5"));
  render("drawable-nodpi/jotrea_splash_icon.png", centered(288, 288, 128, "none"));
  if (JSON.stringify(exported.slice().sort()) !== JSON.stringify(files)) {
    throw new Error("Generator did not export every expected Android branding asset");
  }
  const assets = Object.fromEntries(files.map((relative) => [relative, pngInfo(join(res, relative))]));
  writeFileSync(manifestPath,
    `${JSON.stringify({ recipeSha256: sha256(readFileSync(recipe)), source: pngInfo(source), assets }, null, 2)}\n`);

  if (preview) {
    const output = fileURLToPath(new URL("../../../.local/verification/android-branding-approved.png", import.meta.url));
    mkdirSync(join(output, ".."), { recursive: true });
    const foreground = join(res, "mipmap-xxxhdpi/ic_launcher_foreground.png");
    const masked = join(temp, "adaptive-circle.png");
    const maskResult = spawnSync("magick", [
      "-size", "432x432", "xc:#FFFCF5", foreground, "-compose", "Over", "-composite",
      "(", "-size", "432x432", "xc:none", "-fill", "white",
      // Launcher renders the central 72dp of a 108dp adaptive canvas.
      // At xxxhdpi that is a 288px circle centered on a 432px canvas.
      "-draw", "circle 216,216 216,72", ")",
      "-alpha", "off", "-compose", "CopyOpacity", "-composite",
      "-crop", "288x288+72+72", "+repage",
      // Contrast outside the mask in the review sheet only, not native assets.
      "-background", "#E2DED4", "-alpha", "remove", "-alpha", "off", masked,
    ], { encoding: "utf8" });
    if (maskResult.status !== 0) throw new Error(`Preview mask failed: ${maskResult.stderr || maskResult.error}`);
    const command = [
      "montage", "-background", "#FFFCF5", "-font", "DejaVu-Sans",
      "-fill", "#283e34", "-pointsize", "18",
      "-label", "Original approved art", source,
      "-label", "Legacy launcher", join(res, "mipmap-xxxhdpi/ic_launcher.png"),
      "-label", "Round launcher", join(res, "mipmap-xxxhdpi/ic_launcher_round.png"),
      "-label", "Adaptive circle mask", masked,
      "-label", "Android 12 splash icon", join(res, "drawable-nodpi/jotrea_splash_icon.png"),
      "-label", "Legacy portrait splash", join(res, "drawable-port-mdpi/splash.png"),
      "-thumbnail", "320x240", "-gravity", "center", "-tile", "3x2",
      "-geometry", "330x280+12+12", output,
    ];
    const result = spawnSync("magick", command, { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`Preview failed: ${result.stderr || result.error}`);
    console.log(`Contact sheet: ${output}`);
  }
  console.log(`Generated ${files.length} approved Android branded PNGs and SHA-256 manifest`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}