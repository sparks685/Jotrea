import test from "node:test";
import assert from "node:assert/strict";
import { addAndroidColorFallbacks } from "./android-css-compat.mjs";

test("preserves theme opacity, selectors, states and theme variables on legacy WebViews", () => {
  const css = `.bg-secondary\\/10{background-color:hsl(var(--secondary))}
@supports (color:color-mix(in lab,red,red)){
.bg-secondary\\/10{background-color:color-mix(in oklab,hsl(var(--secondary)) 10%,transparent)}
.hover\\:bg-primary\\/15:hover{background-color:color-mix(in oklab,hsl(var(--primary)) 15%,transparent)}
.border-primary\\/20{border-color:color-mix(in oklab,hsl(var(--primary)) 20%,transparent)}
.bg-foreground\\/40{background-color:color-mix(in oklab,hsl(var(--foreground)) 40%,transparent)}
.text-muted-foreground\\/50{color:color-mix(in oklab,hsl(var(--muted-foreground)) 50%,transparent)}
}`;
  const output = addAndroidColorFallbacks(css);
  assert.ok(output.startsWith(css), "original modern-browser CSS stays intact");
  const fallback = output.slice(css.length);
  assert.match(fallback, /@supports not .*color-mix/);
  assert.match(fallback, /@layer utilities/);
  assert.ok(fallback.includes(".bg-secondary\\/10{background-color:hsl(var(--secondary) / 0.1)}"));
  assert.ok(fallback.includes(".hover\\:bg-primary\\/15:hover{background-color:hsl(var(--primary) / 0.15)}"));
  assert.ok(fallback.includes("border-color:hsl(var(--primary) / 0.2)"));
  assert.ok(fallback.includes("background-color:hsl(var(--foreground) / 0.4)"));
  assert.ok(fallback.includes("color:hsl(var(--muted-foreground) / 0.5)"));
});

test("fails explicitly if the CSS pipeline changes or is patched twice", () => {
  assert.throws(() => addAndroidColorFallbacks("body{color:red}"), /No theme opacity/);
  const css = ".x{color:color-mix(in oklab,hsl(var(--primary)) 10%,transparent)}";
  assert.throws(() => addAndroidColorFallbacks(addAndroidColorFallbacks(css)), /already applied/);
});