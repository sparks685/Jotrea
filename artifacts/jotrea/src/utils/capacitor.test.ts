import { afterEach, describe, expect, it } from "vitest";
import {
  getCapacitorPlatform,
  getSubscriptionManagementUrl,
  isAndroidCapacitor,
  isIosCapacitor,
} from "./capacitor";

describe("Capacitor platform helpers", () => {
  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("selects Android subscription management without changing the iOS URL", () => {
    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: {
        isNativePlatform: () => true,
        getPlatform: () => "android",
      },
    });

    expect(getCapacitorPlatform()).toBe("android");
    expect(isAndroidCapacitor()).toBe(true);
    expect(isIosCapacitor()).toBe(false);
    expect(getSubscriptionManagementUrl()).toBe(
      "https://play.google.com/store/account/subscriptions",
    );

    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: {
        isNativePlatform: () => true,
        getPlatform: () => "ios",
      },
    });
    expect(isAndroidCapacitor()).toBe(false);
    expect(isIosCapacitor()).toBe(true);
    expect(getSubscriptionManagementUrl()).toBe(
      "https://apps.apple.com/account/subscriptions",
    );
  });

  it("defaults to the web platform when the native bridge is absent", () => {
    expect(getCapacitorPlatform()).toBe("web");
    expect(isAndroidCapacitor()).toBe(false);
    expect(isIosCapacitor()).toBe(false);
  });
});