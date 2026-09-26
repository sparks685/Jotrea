import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const res = `${root}android/app/src/main/res/`;
const read = (path) => readFileSync(`${res}${path}`, "utf8");

test("Android launcher and splash are exported from the existing onboarding syringe tile, not Capacitor", () => {
  const onboarding = readFileSync(`${root}src/pages/Onboarding.tsx`, "utf8");
  assert.match(onboarding, /const BRAND = "#D4A574"/);
  assert.match(onboarding, /linear-gradient\(135deg, #e8b989, \$\{BRAND\}\)/);
  assert.match(onboarding, /<Syringe size=\{42\} className="text-white" strokeWidth=\{1\.8\}/);

  const generated = spawnSync(process.execPath, ["scripts/generate-android-branding.mjs", "--check"], {
    cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" },
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.match(generated.stdout, /Verified 27 Android branded PNGs \(Node-only SHA-256 and dimensions\)/);
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const xml = read(`mipmap-anydpi-v26/${name}`);
    assert.match(xml, /@drawable\/ic_launcher_background/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
    assert.match(xml, /@drawable\/ic_launcher_monochrome/);
  }
  const foreground = read("drawable-v24/ic_launcher_foreground.xml");
  const mono = read("drawable/ic_launcher_monochrome.xml");
  assert.match(foreground, /M19,9 L8\.7,19\.3/);
  assert.match(mono, /M19,9 L8\.7,19\.3/);
  assert.doesNotMatch(foreground + mono, /55B8FF|46\.4,24\.7/);
  assert.match(read("drawable/ic_stat_icon_config_sample.xml"), /M19,9 L8\.7,19\.3/);
  assert.match(read("drawable/ic_launcher_background.xml"), /#E8B989/);
  assert.match(read("drawable/ic_launcher_background.xml"), /#D4A574/);
});

test("launch theme uses Android 12 icon/background/post-theme and retains status/navigation contrast", () => {
  const styles = read("values/styles.xml");
  assert.match(styles, /parent="Theme\.SplashScreen"/);
  assert.match(styles, /name="windowSplashScreenAnimatedIcon">@drawable\/jotrea_splash_icon/);
  assert.match(styles, /name="windowSplashScreenBackground">#FFFCF5/);
  assert.match(styles, /name="postSplashScreenTheme">@style\/AppTheme\.NoActionBar/);
  assert.doesNotMatch(styles, /android:background">@drawable\/splash/);
  assert.match(styles, /name="android:windowLightStatusBar">true/);
  assert.match(styles, /name="android:navigationBarColor">#101023/);
  assert.match(readFileSync(`${root}android/app/build.gradle`, "utf8"), /androidx\.core:core-splashscreen:\$coreSplashScreenVersion/);
  assert.match(readFileSync(`${root}android/variables.gradle`, "utf8"), /coreSplashScreenVersion = '1\.0\.1'/);
});