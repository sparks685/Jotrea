import { beforeEach, describe, expect, it, vi } from "vitest";

const { purchases } = vi.hoisted(() => ({
  purchases: {
  configure: vi.fn(),
  getOfferings: vi.fn(),
  getCustomerInfo: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  },
}));

vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: purchases }));

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
    resetSubscriptionServiceForTests();
    (window as unknown as { Capacitor?: unknown }).Capacitor = {
      isNativePlatform: () => false,
    };
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
    purchases.getCustomerInfo.mockResolvedValue({ customerInfo: activeCustomerInfo });
    purchases.restorePurchases.mockResolvedValue({
      customerInfo: { entitlements: { active: {}, all: {
        [PLUS_ENTITLEMENT]: { productIdentifier: "jotrea_plus_annual", expirationDate: "2025-01-01T00:00:00Z", willRenew: false },
      } } },
    });

    await expect(subscriptionService.getStatus()).resolves.toMatchObject({ state: "trial", isPlus: true });
    await expect(subscriptionService.restore()).resolves.toMatchObject({
      state: "expired",
      isPlus: false,
      productId: "jotrea_plus_annual",
      willRenew: false,
    });
  });
});