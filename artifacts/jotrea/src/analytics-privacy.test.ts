import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete window.gtag;
  delete window.dataLayer;
  document.getElementById("ga-script")?.remove();
});

async function analytics(enabled = true) {
  vi.stubEnv("VITE_GA_MEASUREMENT_ID", enabled ? "G-TEST" : "");
  vi.resetModules();
  const api = await import("./lib/analytics");
  window.gtag = vi.fn();
  return api;
}

describe("analytics privacy boundary", () => {
  it.each(["onboarding_complete", "medication_changed", "dose_logged", "weight_logged", "notifications_enabled"])(
    "discards all parameters for %s even from untyped callers", async (name) => {
      const { trackEvent } = await analytics();
      const untyped = trackEvent as (...args: unknown[]) => void;
      untyped(name, { medication: "Private custom medication", dose: 5, notes: "Private notes", weight: 150 });
      expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", name);
    },
  );

  it.each(["csv", "pdf"])("only forwards the approved %s export format", async (format) => {
    const { trackEvent } = await analytics();
    const untyped = trackEvent as (...args: unknown[]) => void;
    untyped("data_exported", { format, medication: "Private medication", notes: "Private notes" });
    expect(window.gtag).toHaveBeenCalledExactlyOnceWith("event", "data_exported", { format });
  });

  it("rejects unknown names, free-text formats and missing formats", async () => {
    const { trackEvent } = await analytics();
    const untyped = trackEvent as (...args: unknown[]) => void;
    untyped("Private medication");
    untyped("data_exported", { format: "Private medication" });
    untyped("data_exported");
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it("keeps analytics disabled without a measurement ID", async () => {
    const { initGA, trackEvent, pageView } = await analytics(false);
    initGA();
    trackEvent("onboarding_complete");
    trackEvent("data_exported", { format: "csv" });
    pageView("/");
    expect(window.gtag).not.toHaveBeenCalled();
    expect(document.getElementById("ga-script")).toBeNull();
    expect(window.dataLayer).toBeUndefined();
  });

  it("does nothing before GA initialization", async () => {
    const { trackEvent } = await analytics();
    delete window.gtag;
    expect(() => trackEvent("medication_changed")).not.toThrow();
  });

  it.each([
    ["pages/Onboarding.tsx", "onboarding_complete"],
    ["components/ChangeMedicationSheet.tsx", "medication_changed"],
  ])("keeps standard and custom flows payload-free in %s", (file, event) => {
    const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const calls: ts.CallExpression[] = [];
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "trackEvent") calls.push(node);
      ts.forEachChild(node, visit);
    }
    visit(source);
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.arguments).toHaveLength(1);
      expect(ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text).toBe(event);
    }
  });
});