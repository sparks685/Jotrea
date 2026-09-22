import { afterEach, describe, expect, it, vi } from "vitest";

const { getInfo } = vi.hoisted(() => ({ getInfo: vi.fn() }));

vi.mock("@capacitor/app", () => ({
  App: { getInfo },
}));

describe("getInstalledAppVersion", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("uses the package version on web", async () => {
    const { getInstalledAppVersion, WEB_APP_VERSION } = await import("./appVersion");
    await expect(getInstalledAppVersion()).resolves.toBe(WEB_APP_VERSION);
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("uses Capacitor App.getInfo in an installed native app", async () => {
    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: { isNativePlatform: () => true, getPlatform: () => "android" },
    });
    getInfo.mockResolvedValue({ version: "1.2", build: "5" });
    const { getInstalledAppVersion } = await import("./appVersion");

    await expect(getInstalledAppVersion()).resolves.toBe("1.2");
  });

  it("falls back to the package version if native version lookup fails", async () => {
    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: { isNativePlatform: () => true, getPlatform: () => "android" },
    });
    getInfo.mockRejectedValue(new Error("plugin unavailable"));
    const { getInstalledAppVersion, WEB_APP_VERSION } = await import("./appVersion");

    await expect(getInstalledAppVersion()).resolves.toBe(WEB_APP_VERSION);
  });
});