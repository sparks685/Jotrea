import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
const critical = html.match(/<style id="jotrea-canvas-theme">([\s\S]*?)<\/style>/)?.[1];
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

test("full-width canvas uses the active background, without fixed inline cream overrides", () => {
  assert.ok(critical);
  assert.doesNotMatch(html, /<(?:html|body)\b[^>]*style=/);
  assert.match(critical, /html,\s*body,\s*#root\s*\{\s*background-color:\s*hsl\(var\(--background\)\)/);
  assert.doesNotMatch(critical, /@media|oklch|color-mix/);
  // No viewport-specific colors: portrait and landscape use the same canvas.
  for (const selector of [":root", ".dark"]) {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf("}", start));
    const color = block.match(/--background:\s*([^;]+)/)?.[1];
    assert.ok(color);
    assert.ok(critical.includes(`${selector} { --background: ${color};`));
  }
  assert.match(critical, /color-scheme:\s*light/);
  assert.match(critical, /color-scheme:\s*dark/);
});

test("startup resolves stored and Auto themes before the body paints", () => {
  assert.ok(bootstrap);
  assert.ok(html.indexOf(bootstrap) < html.indexOf("<body>"));
  for (const stored of ["light", "dark", "system", null]) {
    for (const systemDark of [false, true]) {
      const classes = new Set();
      runInNewContext(bootstrap, {
        localStorage: { getItem: () => stored },
        window: { matchMedia: () => ({ matches: systemDark }) },
        document: { documentElement: { classList: { add: (name) => classes.add(name) } } },
      });
      assert.equal(classes.has("dark"), stored === "dark" || (stored !== "light" && systemDark));
    }
  }
});