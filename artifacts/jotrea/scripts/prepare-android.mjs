import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const appDir = fileURLToPath(new URL("../", import.meta.url));
const env = loadEnv("production", appDir, "VITE_");
// This is a public mobile SDK key, not a service-account or RevenueCat secret key.
if (!env.VITE_REVENUECAT_ANDROID_API_KEY?.startsWith("goog_")) {
  console.error("Android build stopped: set VITE_REVENUECAT_ANDROID_API_KEY to your Google Play public SDK key (goog_…) in the build environment or artifacts/jotrea/.env.local. Never use a service-account JSON or a secret API key.");
  process.exit(1);
}

for (const args of [
  ["exec", "vite", "build", "--config", "vite.config.ts", "--base", "/"],
  ["exec", "cap", "sync", "android"],
]) {
  const result = spawnSync("pnpm", args, {
    cwd: appDir,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("Android web assets and native plugins are ready. Run pnpm --filter @workspace/jotrea android:open to open Android Studio.");