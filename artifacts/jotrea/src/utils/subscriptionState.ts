import type { SubscriptionStatus, UserData } from "@/types";

export function hasExpiredSubscription(
  expiresAt: string | undefined,
  now = Date.now()
): boolean {
  if (!expiresAt) return false;
  const expiresAtMs = Date.parse(expiresAt);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= now;
}

export function removeExpiredCachedPlus(
  user: UserData,
  now = Date.now()
): UserData {
  if (
    user.subscription !== "premium" ||
    !hasExpiredSubscription(user.subscriptionExpiresAt, now)
  ) {
    return user;
  }

  return {
    ...user,
    subscription: "free",
    subscriptionProductId: undefined,
    subscriptionExpiresAt: undefined,
    trialEndDate: undefined,
  };
}

export function applySubscriptionStatus(
  user: UserData,
  status: SubscriptionStatus
): UserData {
  return {
    ...user,
    subscription: status.isPlus ? "premium" : "free",
    subscriptionProductId: status.isPlus ? status.productId : undefined,
    subscriptionExpiresAt: status.isPlus ? status.expiresAt : undefined,
    trialEndDate:
      status.isPlus && status.state === "trial" ? status.expiresAt : undefined,
  };
}