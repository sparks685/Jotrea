import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Tailwind's optimized fallback drops opacity for theme colors containing var().
// Preserve it on older Android WebViews without freezing light/dark theme values.
export function addAndroidColorFallbacks(css) {
  const marker = "/* Android legacy WebView theme opacity */";
  if (css.includes(marker)) throw new Error("Android CSS compatibility already applied");
  const rules = [];
  const mix = /color-mix\(\s*in\s+oklab\s*,\s*hsl\(\s*var\((--[\w-]+)\)\s*\)\s+([\d.]+)%\s*,\s*transparent\s*\)/g;
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    const declarations = body.split(";").filter((declaration) => {
      mix.lastIndex = 0;
      return mix.test(declaration);
    });
    if (!declarations.length) continue;
    const fallback = declarations.join(";").replace(mix, (_, variable, percent) =>
      `hsl(var(${variable}) / ${Number(percent) / 100})`);
    rules.push(`${selector.trim()}{${fallback}}`);
  }
  if (!rules.length) throw new Error("No theme opacity rules found; review Android CSS compatibility");
  return `${css}\n${marker}\n@supports not (color: color-mix(in oklab, red, transparent)) {\n@layer utilities {\n${[...new Set(rules)].join("\n")}\n}\n}\n`;
}

export function patchAndroidCss(distDir) {
  const assetsDir = join(distDir, "assets");
  const files = readdirSync(assetsDir).filter((file) => file.endsWith(".css"));
  let patched = 0;
  for (const file of files) {
    const path = join(assetsDir, file);
    const css = readFileSync(path, "utf8");
    if (!css.includes("hsl(var(--")) continue;
    writeFileSync(path, addAndroidColorFallbacks(css));
    patched++;
  }
  if (!patched) throw new Error("Android CSS bundle not found; refusing to sync unpatched assets");
  console.log(`Added legacy WebView theme opacity fallbacks to ${patched} Android CSS bundle(s).`);
}