import { afterEach, describe, expect, it, vi } from "vitest";

const setMode = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@capacitor/core", () => ({
  registerPlugin: () => ({ setMode }),
}));

import { syncAndroidSystemBars } from "./androidSystemBars";

function platform(name: string, native: boolean) {
  Object.defineProperty(window, "Capacitor", {
    configurable: true,
    value: {
      getPlatform: () => name,
      isNativePlatform: () => native,
    },
  });
}

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  setMode.mockClear();
});

describe("Android system bar adapter", () => {
  it("does not call the native bridge on web or iOS", () => {
    syncAndroidSystemBars("dark");
    platform("ios", true);
    syncAndroidSystemBars("dark");
    expect(setMode).not.toHaveBeenCalled();
  });

  it("sends the preference, including system (not the resolved color)", () => {
    platform("android", true);
    syncAndroidSystemBars("light");
    syncAndroidSystemBars("dark");
    syncAndroidSystemBars("system");
    expect(setMode.mock.calls).toEqual([
      [{ mode: "light" }],
      [{ mode: "dark" }],
      [{ mode: "system" }],
    ]);
  });

  it("surfaces native errors instead of silently ignoring them", async () => {
    platform("android", true);
    const error = new Error("plugin unavailable");
    setMode.mockRejectedValueOnce(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      syncAndroidSystemBars("system");
      await vi.waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Unable to update Android system bars:", error);
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});