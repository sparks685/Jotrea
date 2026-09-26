import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const res = `${root}android/app/src/main/res/`;
const read = (path) => readFileSync(`${res}${path}`, "utf8");

test("all launcher/splash densities come from the exact approved image without ImageMagick at test time", () => {
  const manifest = JSON.parse(readFileSync(`${root}scripts/android-branding-assets.json`, "utf8"));
  assert.equal(manifest.source.sha256, "9951f5aa727d3c25ce5d87f5f8e5487922e86454b5343af3400e594c0f8a4662");
  assert.deepEqual([manifest.source.width, manifest.source.height], [1024, 1024]);
  const generated = spawnSync(process.execPath, ["scripts/generate-android-branding.mjs", "--check"], {
    cwd: root, encoding: "utf8", env: { ...process.env, PATH: "" },
  });
  assert.equal(generated.status, 0, generated.stderr || generated.stdout);
  assert.match(generated.stdout, /Verified 27 approved Android branded PNGs \(Node-only SHA-256 and dimensions\)/);
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const xml = read(`mipmap-anydpi-v26/${name}`);
    assert.match(xml, /@drawable\/ic_launcher_background/);
    assert.match(xml, /@mipmap\/ic_launcher_foreground/);
    assert.doesNotMatch(xml, /monochrome/);
  }
  assert.match(read("drawable/ic_launcher_background.xml"), /#FFFCF5/);
  assert.equal(manifest.assets["drawable-nodpi/jotrea_splash_icon.png"].width, 288);
  assert.equal(manifest.assets["drawable-nodpi/jotrea_splash_icon.png"].height, 288);
  const originalNotification = read("drawable/ic_stat_icon_config_sample.xml");
  assert.match(originalNotification, /M46\.4,24\.7L61\.2,39\.5/);
  assert.doesNotMatch(originalNotification, /M19,9 L8\.7,19\.3/);
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