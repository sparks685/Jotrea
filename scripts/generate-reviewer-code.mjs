import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  console.error("Reviewer-code clipboard generation is supported on macOS only.");
  process.exit(1);
}

const code = randomBytes(32).toString("hex");
const result = spawnSync("pbcopy", [], {
  input: code,
  encoding: "utf8",
});

if (result.error || result.status !== 0) {
  console.error("Could not copy the reviewer code to the macOS clipboard.");
  process.exit(1);
}

console.log("Generated one reviewer code and copied it to the macOS clipboard. Paste that same clipboard value into each secure destination; do not generate a second code.");