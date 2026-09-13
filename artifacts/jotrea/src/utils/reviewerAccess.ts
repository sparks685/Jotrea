import { isAndroidCapacitor } from "@/utils/capacitor";
import type { ReviewerAccessGrant } from "@/types";

export const REVIEWER_ACCESS_STORAGE_KEY = "jotrea_reviewer_access";

/**
 * Keep the reviewer entitlement independent from the paid subscription record.
 * The platform check is intentionally repeated here (and in isPremium) so a
 * copied localStorage value can never unlock reviewer access on iOS or web.
 */
export function isValidReviewerAccessGrant(value: unknown): value is ReviewerAccessGrant {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  return (
    grant.platform === "android" &&
    grant.access === "jotrea_plus" &&
    typeof grant.activatedAt === "string" &&
    grant.activatedAt.length > 0 &&
    Number.isFinite(Date.parse(grant.activatedAt))
  );
}

export function hasReviewerAccess(grant: ReviewerAccessGrant | null | undefined): boolean {
  return isAndroidCapacitor() && isValidReviewerAccessGrant(grant);
}

export function readReviewerAccessGrant(): ReviewerAccessGrant | null {
  if (!isAndroidCapacitor() || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REVIEWER_ACCESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidReviewerAccessGrant(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function dispatchReviewerAccessStorageEvent(newValue: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new StorageEvent("storage", {
      key: REVIEWER_ACCESS_STORAGE_KEY,
      newValue,
    }));
  } catch {
    // StorageEvent is unavailable in a few embedded webviews. The persisted
    // value is still correct; a reload will pick it up.
  }
}

export function storeReviewerAccessGrant(grant: ReviewerAccessGrant): void {
  if (!isAndroidCapacitor() || !isValidReviewerAccessGrant(grant)) return;
  const serialized = JSON.stringify(grant);
  try {
    window.localStorage.setItem(REVIEWER_ACCESS_STORAGE_KEY, serialized);
  } catch {
    throw new Error("Reviewer access could not be saved on this device. Please try again.");
  }
  dispatchReviewerAccessStorageEvent(serialized);
}

export function clearReviewerAccessGrant(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REVIEWER_ACCESS_STORAGE_KEY);
  } finally {
    dispatchReviewerAccessStorageEvent(null);
  }
}