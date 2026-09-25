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
  assert.match(activity, /onCreate\(Bundle savedInstanceState\)[\s\S]*?super\.onCreate\(savedInstanceState\);\s*SystemBarsPlugin\.apply\(this\)/);
  assert.match(activity, /onResume\(\)\s*\{\s*super\.onResume\(\);\s*SystemBarsPlugin\.apply\(this\)/);
  assert.match(activity, /onConfigurationChanged\(Configuration configuration\)\s*\{\s*super\.onConfigurationChanged\(configuration\);[\s\S]*?SystemBarsPlugin\.apply\(this\)/);
  assert.match(activity, /onWindowFocusChanged\(boolean hasFocus\)\s*\{\s*super\.onWindowFocusChanged\(hasFocus\);[\s\S]*?if \(hasFocus\)\s*\{\s*SystemBarsPlugin\.apply\(this\)/);
  assert.match(plugin, /@CapacitorPlugin\(name = "JotreaSystemBars"\)/);
  assert.match(plugin, /getString\(KEY_MODE, "system"\)/);
  assert.match(plugin, /"dark"\.equals\(mode\)[\s\S]*?"system"\.equals\(mode\)[\s\S]*?UI_MODE_NIGHT_MASK[\s\S]*?UI_MODE_NIGHT_YES/);
  assert.match(plugin, /int color = dark \? DARK : LIGHT/);
  assert.match(plugin, /setBackgroundDrawable\(new ColorDrawable\(color\)\)/);
  assert.match(plugin, /setStatusBarColor\(color\)[\s\S]*?setNavigationBarColor\(color\)[\s\S]*?getInsetsController\([\s\S]*?setAppearanceLightStatusBars\(!dark\)/);
  assert.match(plugin, /if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.O\)\s*\{\s*controller\.setAppearanceLightNavigationBars\(!dark\);\s*\} else \{\s*window\.setNavigationBarColor\(DARK\)/);
  assert.doesNotMatch(plugin, /(?:get|set)SystemUiVisibility\(|SYSTEM_UI_FLAG_LIGHT_/);
});

test("Capacitor insets handler adjusts WebView margins, not icon appearance", () => {
  const webview = read("node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/CapacitorWebView.java");
  assert.match(webview, /edgeToEdgeHandler\(Bridge bridge\)/);
  assert.match(webview, /setOnApplyWindowInsetsListener\(this,/);
  assert.match(webview, /mlp\.topMargin = insets\.top/);
  assert.doesNotMatch(webview, /setSystemUiVisibility|setAppearanceLightStatusBars/);
  const theme = read("android/app/src/main/res/values/styles.xml");
  assert.match(theme, /name="AppTheme\.NoActionBar"[\s\S]*?android:windowLightStatusBar">true/);
  assert.match(theme, /name="AppTheme\.NoActionBarLaunch"[\s\S]*?android:windowLightStatusBar">true/);
});