import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Android release and edge-to-edge configuration", () => {
  const gradle = read("android/app/build.gradle");
  const vars = read("android/variables.gradle");
  const config = read("capacitor.config.ts");
  assert.match(gradle, /versionCode 6\b/);
  assert.match(gradle, /versionName "1\.3"/);
  assert.equal(JSON.parse(read("package.json")).version, "1.3.0");
  assert.match(vars, /minSdkVersion = 24/);
  assert.match(vars, /targetSdkVersion = 36/);
  assert.match(config, /adjustMarginsForEdgeToEdge: "auto"/);
  assert.match(read("index.html"), /viewport-fit=cover/);
});

test("native bridge tracks preferences, system changes and icon contrast", () => {
  const plugin = read("android/app/src/main/java/com/sparky/jotrea/SystemBarsPlugin.java");
  const activity = read("android/app/src/main/java/com/sparky/jotrea/MainActivity.java");
  assert.match(activity, /registerPlugin\(SystemBarsPlugin\.class\)/);
  assert.match(activity, /onResume\(\)/);
  assert.match(activity, /onConfigurationChanged\(Configuration configuration\)/);
  assert.match(plugin, /@CapacitorPlugin\(name = "JotreaSystemBars"\)/);
  assert.match(plugin, /UI_MODE_NIGHT_MASK/);
  assert.match(plugin, /SYSTEM_UI_FLAG_LIGHT_STATUS_BAR/);
  assert.match(plugin, /SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR/);
  assert.match(plugin, /VERSION_CODES\.O/);
  assert.match(plugin, /setNavigationBarColor\(DARK\)/);
});