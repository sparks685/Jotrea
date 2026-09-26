import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("Android release and edge-to-edge configuration", () => {
  const gradle = read("android/app/build.gradle");
  const vars = read("android/variables.gradle");
  const config = read("capacitor.config.ts");
  assert.match(gradle, /versionCode 9\b/);
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
  assert.match(plugin, /getWebView\(\)\.setBackgroundColor\(color\)/);
  assert.match(plugin, /setStatusBarColor\(color\)[\s\S]*?setNavigationBarColor\(color\)[\s\S]*?getInsetsController\([\s\S]*?setAppearanceLightStatusBars\(!dark\)/);
  assert.match(plugin, /if \(Build\.VERSION\.SDK_INT >= Build\.VERSION_CODES\.O\)\s*\{\s*controller\.setAppearanceLightNavigationBars\(!dark\);\s*\} else \{\s*window\.setNavigationBarColor\(DARK\)/);
  assert.doesNotMatch(plugin, /(?:get|set)SystemUiVisibility\(|SYSTEM_UI_FLAG_LIGHT_/);
});

test("splash exit restores the selected bar theme, not fixed launch colors", () => {
  const plugin = read("android/app/src/main/java/com/sparky/jotrea/SystemBarsPlugin.java");
  assert.match(plugin, /activity\.getTheme\(\)\.applyStyle\(\s*dark \? R\.style\.JotreaSystemBarsDark : R\.style\.JotreaSystemBarsLight, true\)/);
  assert.ok(plugin.indexOf("getTheme().applyStyle(") < plugin.indexOf("window.setStatusBarColor(color)"));
  // No delayed retry/polling: the splash's own theme restoration must be right.
  assert.doesNotMatch(plugin, /postDelayed|Thread\.sleep|Timer/);
  assert.match(plugin, /getSharedPreferences\(PREFS, Context\.MODE_PRIVATE\)[\s\S]*?putString\(KEY_MODE, mode\)[\s\S]*?apply\(getActivity\(\)\)/);
});

test("bar-only overlays match native colors and preserve pre-26 navigation contrast", () => {
  const plugin = read("android/app/src/main/java/com/sparky/jotrea/SystemBarsPlugin.java");
  const nativeColor = (name) => {
    const rgb = plugin.match(new RegExp(`${name} = Color\\.rgb\\((\\d+), (\\d+), (\\d+)\\)`));
    assert.ok(rgb);
    return "#" + rgb.slice(1).map((value) => Number(value).toString(16).padStart(2, "0")).join("").toUpperCase();
  };
  for (const directory of ["values", "values-v26"]) {
    const xml = read(`android/app/src/main/res/${directory}/system_bars.xml`);
    assert.doesNotMatch(xml, /<item name="(?:windowSplash|postSplash|android:windowBackground|android:background)/);
    for (const mode of ["Light", "Dark"]) {
      const body = xml.match(new RegExp(`<style name="JotreaSystemBars${mode}" parent="">([\\s\\S]*?)</style>`))?.[1];
      assert.ok(body);
      const items = Object.fromEntries([...body.matchAll(/<item name="([^"]+)">([^<]+)<\/item>/g)].map((match) => [match[1], match[2]]));
      const color = nativeColor(mode === "Dark" ? "DARK" : "LIGHT");
      assert.equal(items["android:statusBarColor"], color);
      assert.equal(items["android:navigationBarColor"], directory === "values" ? nativeColor("DARK") : color);
      assert.equal(items["android:windowLightStatusBar"], String(mode === "Light"));
      assert.equal(items["android:windowLightNavigationBar"], directory === "values" ? undefined : String(mode === "Light"));
      assert.equal(Object.keys(items).length, directory === "values" ? 3 : 4);
    }
  }
});

test("Android renderer diagnostics are opt-in and debug-only", () => {
  const activity = read("android/app/src/main/java/com/sparky/jotrea/MainActivity.java");
  const plugin = read("android/app/src/main/java/com/sparky/jotrea/RenderDiagnosticsPlugin.java");
  assert.match(activity, /if \(\(getApplicationInfo\(\)\.flags & ApplicationInfo\.FLAG_DEBUGGABLE\) != 0\)\s*\{\s*registerPlugin\(RenderDiagnosticsPlugin\.class\)/);
  assert.match(plugin, /ApplicationInfo\.FLAG_DEBUGGABLE\) == 0/);
  assert.equal((plugin.match(/if \(!allow\(call\)\) return;/g) || []).length, 2);
  assert.match(plugin, /LAYER_TYPE_SOFTWARE : View\.LAYER_TYPE_NONE/);
  assert.match(plugin, /getCurrentWebViewPackage\(\)/);
  assert.match(plugin, /view\.isOpaque\(\)/);
  assert.doesNotMatch(plugin, /clearCache\(|clearHistory\(|reload\(|setJavaScriptEnabled\(/);
  assert.doesNotMatch(read("android/app/src/main/AndroidManifest.xml"), /hardwareAccelerated="false"/);
});

test("Android page uses a constrained opaque scroller without changing iOS", () => {
  const app = read("src/App.tsx");
  assert.match(app, /isAndroidCapacitor\(\) \? "h-\[100dvh\]" : "min-h-\[100dvh\]"/);
  assert.match(app, /data-jotrea-page-scroll/);
  assert.match(app, /isAndroidCapacitor\(\) \? " min-h-0 bg-background" : ""/);
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