import { Purchases } from "@revenuecat/purchases-capacitor";
import type { SubscriptionProduct, SubscriptionStatus } from "@/types";
import { isNativeCapacitor } from "@/utils/capacitor";

export const PLUS_ENTITLEMENT = "jotrea_plus";

const FALLBACK_PRODUCTS: SubscriptionProduct[] = [
  { id: "jotrea_plus_monthly", interval: "month", displayName: "Monthly", displayPrice: "$4.99", trialDays: 14 },
  { id: "jotrea_plus_annual", interval: "year", displayName: "Annual", displayPrice: "$39.99", trialDays: 14 },
];

export interface SubscriptionProvider {
  getProducts(): Promise<SubscriptionProduct[]>;
  getStatus(): Promise<SubscriptionStatus>;
  purchase(productId: string): Promise<SubscriptionStatus>;
  restore(): Promise<SubscriptionStatus>;
}

type RevenueCatPackage = {
  identifier: string;
  packageType?: string;
  product: {
    identifier: string;
    priceString: string;
    subscriptionPeriod?: string | null;
    introductoryPrice?: unknown;
    discounts?: unknown[];
  };
};

type RevenueCatEntitlement = {
  productIdentifier?: string;
  expirationDate?: string | null;
  willRenew?: boolean;
  periodType?: string;
};

type RevenueCatCustomerInfo = {
  entitlements: {
    active: Record<string, RevenueCatEntitlement>;
    all?: Record<string, RevenueCatEntitlement>;
  };
};

let configurePromise: Promise<void> | null = null;
let packagesByProductId = new Map<string, RevenueCatPackage>();

function unavailable(): Error {
  return new Error("Purchases are not available in this version of Jotrea.");
}

async function configurePurchases(): Promise<void> {
  if (!isNativeCapacitor()) throw unavailable();
  if (!configurePromise) {
    const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
    if (!apiKey) {
      throw new Error("Purchases are unavailable because the RevenueCat iOS API key is not configured.");
    }
    configurePromise = Purchases.configure({ apiKey });
  }
  return configurePromise;
}

function intervalFor(aPackage: RevenueCatPackage): "month" | "year" {
  const packageType = aPackage.packageType?.toLowerCase() ?? "";
  const period = aPackage.product.subscriptionPeriod?.toLowerCase() ?? "";
  return packageType.includes("annual") || period.includes("year") || period.includes("p1y")
    ? "year"
    : "month";
}

function trialDaysFor(aPackage: RevenueCatPackage): number | undefined {
  const intro = aPackage.product.introductoryPrice as Record<string, unknown> | null | undefined;
  if (!intro) return undefined;
  const periodNumber = Number(intro.periodNumber ?? intro.periodCount ?? 0);
  const periodUnit = String(intro.periodUnit ?? intro.subscriptionPeriod ?? "").toLowerCase();
  if (!Number.isFinite(periodNumber) || periodNumber <= 0) return undefined;
  if (periodUnit.includes("day")) return periodNumber;
  if (periodUnit.includes("week")) return periodNumber * 7;
  return undefined;
}

function mapPackage(aPackage: RevenueCatPackage): SubscriptionProduct {
  const interval = intervalFor(aPackage);
  return {
    id: aPackage.product.identifier,
    interval,
    displayName: interval === "year" ? "Annual" : "Monthly",
    displayPrice: aPackage.product.priceString,
    trialDays: trialDaysFor(aPackage),
  };
}

function mapCustomerInfo(customerInfo: RevenueCatCustomerInfo): SubscriptionStatus {
  const active = customerInfo.entitlements.active[PLUS_ENTITLEMENT];
  const entitlement = active ?? customerInfo.entitlements.all?.[PLUS_ENTITLEMENT];
  if (!active) {
    return {
      state: entitlement?.expirationDate ? "expired" : "free",
      isPlus: false,
      productId: entitlement?.productIdentifier,
      expiresAt: entitlement?.expirationDate ?? undefined,
      willRenew: entitlement?.willRenew,
    };
  }
  return {
    state: active.periodType?.toLowerCase() === "trial" ? "trial" : "active",
    isPlus: true,
    productId: active.productIdentifier,
    expiresAt: active.expirationDate ?? undefined,
    willRenew: active.willRenew,
  };
}

async function getCurrentPackages(): Promise<RevenueCatPackage[]> {
  await configurePurchases();
  const offerings = await Purchases.getOfferings();
  const packages = ((offerings.current?.availablePackages ?? []) as unknown) as RevenueCatPackage[];
  packagesByProductId = new Map(packages.map((aPackage) => [aPackage.product.identifier, aPackage]));
  return packages;
}

export const subscriptionService: SubscriptionProvider = {
  async getProducts() {
    if (!isNativeCapacitor()) return FALLBACK_PRODUCTS;
    const packages = await getCurrentPackages();
    return packages.length > 0 ? packages.map(mapPackage) : FALLBACK_PRODUCTS;
  },
  async getStatus() {
    if (!isNativeCapacitor()) return { state: "free", isPlus: false };
    await configurePurchases();
    await Purchases.invalidateCustomerInfoCache();
    const { customerInfo } = await Purchases.getCustomerInfo();
    return mapCustomerInfo(customerInfo as unknown as RevenueCatCustomerInfo);
  },
  async purchase(productId) {
    if (!isNativeCapacitor()) throw unavailable();
    let aPackage = packagesByProductId.get(productId);
    if (!aPackage) {
      await getCurrentPackages();
      aPackage = packagesByProductId.get(productId);
    }
    if (!aPackage) throw new Error("That subscription option is no longer available. Please try again.");
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: aPackage as never });
    return mapCustomerInfo(customerInfo as unknown as RevenueCatCustomerInfo);
  },
  async restore() {
    if (!isNativeCapacitor()) throw unavailable();
    await configurePurchases();
    const { customerInfo } = await Purchases.restorePurchases();
    return mapCustomerInfo(customerInfo as unknown as RevenueCatCustomerInfo);
  },
};

export { FALLBACK_PRODUCTS };

export function resetSubscriptionServiceForTests(): void {
  configurePromise = null;
  packagesByProductId = new Map();
}