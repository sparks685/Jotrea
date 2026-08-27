import { describe, expect, it } from "vitest";
import type { SubscriptionStatus, UserData } from "@/types";
import {
  applySubscriptionStatus,
  hasExpiredSubscription,
  removeExpiredCachedPlus,
} from "@/utils/subscriptionState";

const BASE_USER: UserData = {
  name: "Test User",
  units: "lbs",
  subscription: "premium",
  subscriptionProductId: "jotrea_plus_monthly",
};

describe("subscription state", () => {
  it("recognizes an expired entitlement timestamp", () => {
    expect(
      hasExpiredSubscription("2026-08-26T20:00:00.000Z", Date.parse("2026-08-27T00:00:00.000Z"))
    ).toBe(true);
    expect(
      hasExpiredSubscription("2026-08-28T20:00:00.000Z", Date.parse("2026-08-27T00:00:00.000Z"))
    ).toBe(false);
  });

  it("fails closed when cached Plus access has expired", () => {
    const result = removeExpiredCachedPlus(
      {
        ...BASE_USER,
        subscriptionExpiresAt: "2026-08-26T20:00:00.000Z",
        trialEndDate: "2026-08-26T20:00:00.000Z",
      },
      Date.parse("2026-08-27T00:00:00.000Z")
    );

    expect(result).toMatchObject({ subscription: "free" });
    expect(result.subscriptionProductId).toBeUndefined();
    expect(result.subscriptionExpiresAt).toBeUndefined();
    expect(result.trialEndDate).toBeUndefined();
  });

  it("keeps cached Plus access before its expiration", () => {
    const user = {
      ...BASE_USER,
      subscriptionExpiresAt: "2026-08-28T20:00:00.000Z",
    };
    expect(
      removeExpiredCachedPlus(user, Date.parse("2026-08-27T00:00:00.000Z"))
    ).toBe(user);
  });

  it("applies active and expired RevenueCat status without stale access", () => {
    const active: SubscriptionStatus = {
      state: "trial",
      isPlus: true,
      productId: "jotrea_plus_monthly",
      expiresAt: "2026-08-28T20:00:00.000Z",
    };
    const subscribed = applySubscriptionStatus(
      { ...BASE_USER, subscription: "free" },
      active
    );
    expect(subscribed).toMatchObject({
      subscription: "premium",
      subscriptionProductId: "jotrea_plus_monthly",
      trialEndDate: active.expiresAt,
    });

    const expired = applySubscriptionStatus(subscribed, {
      state: "expired",
      isPlus: false,
      productId: "jotrea_plus_monthly",
      expiresAt: "2026-08-26T20:00:00.000Z",
    });
    expect(expired.subscription).toBe("free");
    expect(expired.subscriptionProductId).toBeUndefined();
    expect(expired.subscriptionExpiresAt).toBeUndefined();
    expect(expired.trialEndDate).toBeUndefined();
  });
});