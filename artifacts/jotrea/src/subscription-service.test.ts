import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Capacitor } from "@capacitor/core";

const { purchases } = vi.hoisted(() => ({
  purchases: {
    configure: vi.fn(),
    getOfferings: vi.fn(),
    getCustomerInfo: vi.fn(),
    invalidateCustomerInfoCache: vi.fn(),
    purchasePackage: vi.fn(),
    restorePurchases: vi.fn(),
  },
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: purchases }));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: vi.fn() } }));

import {
  FALLBACK_PRODUCTS,
  PLUS_ENTITLEMENT,
  resetSubscriptionServiceForTests,
  subscriptionService,
} from "@/services/subscriptionService";

const monthlyPackage = {
  identifier: "$rc_monthly",
  packageType: "MONTHLY",
  product: {
    identifier: "jotrea_plus_monthly",
    priceString: "$4.99",
    subscriptionPeriod: "P1M",
    introductoryPrice: { periodNumber: 14, periodUnit: "DAY" },
  },
};

const activeCustomerInfo = {
  entitlements: {
    active: {
      [PLUS_ENTITLEMENT]: {
        productIdentifier: "jotrea_plus_monthly",
        expirationDate: "2027-01-01T00:00:00Z",
        willRenew: true,
        periodType: "TRIAL",
      },
    },
    all: {},
  },
};

describe("RevenueCat subscription service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_REVENUECAT_IOS_API_KEY", "appl_test_key");
    vi.stubEnv("VITE_REVENUECAT_ANDROID_API_KEY", "goog_test_key");
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    resetSubscriptionServiceForTests();
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => false,
    };
  });

  afterEach(() => vi.unstubAllEnvs());

  it("uses the Android key for Android purchases", async () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    purchases.configure.mockResolvedValue(undefined);
    purchases.getOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    purchases.purchasePackage.mockResolvedValue({ customerInfo: activeCustomerInfo });
    await subscriptionService.getProducts();
    await subscriptionService.purchase("jotrea_plus_monthly");
    expect(purchases.configure).toHaveBeenCalledExactlyOnceWith({ apiKey: "goog_test_key" });
    expect(purchases.purchasePackage).toHaveBeenCalledWith({ aPackage: monthlyPackage });
  });

  it.each(["ios", "android"])("rejects a missing %s key without using the other platform's key", async (platform) => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
    vi.stubEnv(platform === "android" ? "VITE_REVENUECAT_ANDROID_API_KEY" : "VITE_REVENUECAT_IOS_API_KEY", "");
    await expect(subscriptionService.getProducts()).rejects.toThrow(`${platform === "ios" ? "iOS" : "Android"} API key is not configured`);
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it("provides safe metadata fallbacks and never simulates web purchase", async () => {
    await expect(subscriptionService.getProducts()).resolves.toEqual(FALLBACK_PRODUCTS);
    await expect(subscriptionService.purchase("jotrea_plus_monthly"))
      .rejects.toThrow("Purchases are not available");
    expect(purchases.configure).not.toHaveBeenCalled();
  });

  it("configures once, maps current offering metadata, and purchases its selected package", async () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    purchases.configure.mockResolvedValue(undefined);
    purchases.getOfferings.mockResolvedValue({ current: { availablePackages: [monthlyPackage] } });
    purchases.purchasePackage.mockResolvedValue({ customerInfo: activeCustomerInfo });

    const products = await subscriptionService.getProducts();
    expect(products).toEqual([{
      id: "jotrea_plus_monthly",
      interval: "month",
      displayName: "Monthly",
      displayPrice: "$4.99",
      trialDays: 14,
    }]);
    await expect(subscriptionService.purchase("jotrea_plus_monthly")).resolves.toMatchObject({
      state: "trial",
      isPlus: true,
      willRenew: true,
    });
    expect(purchases.configure).toHaveBeenCalledTimes(1);
    expect(purchases.configure).toHaveBeenCalledWith({ apiKey: "appl_test_key" });
    expect(purchases.purchasePackage).toHaveBeenCalledWith({ aPackage: monthlyPackage });
  });

  it("maps restored and current customer entitlement status", async () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    purchases.configure.mockResolvedValue(undefined);
    purchases.invalidateCustomerInfoCache.mockResolvedValue(undefined);
    purchases.getCustomerInfo.mockResolvedValue({ customerInfo: activeCustomerInfo });
    purchases.restorePurchases.mockResolvedValue({
      customerInfo: { entitlements: { active: {}, all: {
        [PLUS_ENTITLEMENT]: { productIdentifier: "jotrea_plus_annual", expirationDate: "2025-01-01T00:00:00Z", willRenew: false },
      } } },
    });

    await expect(subscriptionService.getStatus()).resolves.toMatchObject({ state: "trial", isPlus: true });
    expect(purchases.invalidateCustomerInfoCache).toHaveBeenCalledTimes(1);
    expect(purchases.invalidateCustomerInfoCache.mock.invocationCallOrder[0])
      .toBeLessThan(purchases.getCustomerInfo.mock.invocationCallOrder[0]);
    await expect(subscriptionService.restore()).resolves.toMatchObject({
      state: "expired",
      isPlus: false,
      productId: "jotrea_plus_annual",
      willRenew: false,
    });
  });
});
