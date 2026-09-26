import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(import.meta.dirname, "index.css"), "utf8");

describe("medical notice theme", () => {
  it("defines solid light and dark semantic colors without modern color-mixing dependencies", () => {
    const light = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1];
    const dark = css.match(/\.dark\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(light).toBeDefined();
    expect(dark).toBeDefined();
    for (const token of [
      "bg", "border", "heading", "body", "icon-bg", "icon", "link",
    ]) {
      const name = `--med-notice-${token}`;
      expect(light).toMatch(new RegExp(`${name}: #[0-9a-f]{6};`));
      expect(dark).toMatch(new RegExp(`${name}: #[0-9a-f]{6};`));
      expect(light?.match(new RegExp(`${name}: ([^;]+);`))?.[1])
        .not.toBe(dark?.match(new RegExp(`${name}: ([^;]+);`))?.[1]);
    }
    const noticeRules = css.slice(css.indexOf("/* Solid semantic colors"), css.indexOf("@layer base"));
    expect(noticeRules).not.toMatch(/color-mix|\/\d+|opacity:/);
    expect(noticeRules).toContain("background-color: var(--med-notice-bg)");
    expect(noticeRules).toContain("color: var(--med-notice-body)");
  });
});