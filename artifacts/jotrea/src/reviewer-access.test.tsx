import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ReviewerAccessGrant, UserData } from "@/types";
import { isPremium } from "@/utils/featureGates";
import {
  clearReviewerAccessGrant,
  readReviewerAccessGrant,
  REVIEWER_ACCESS_STORAGE_KEY,
  storeReviewerAccessGrant,
} from "@/utils/reviewerAccess";
import {
  requestReviewerAccess,
  REVIEWER_ACCESS_TIMEOUT_MS,
  REVIEWER_ACCESS_URL,
} from "@/services/reviewerAccessService";
import { useReviewerAccess } from "@/hooks/useReviewerAccess";
import { resolvePlusAccess } from "@/pages/Plus";

const GRANT: ReviewerAccessGrant = {
  platform: "android",
  access: "jotrea_plus",
  activatedAt: "2026-09-10T12:00:00.000Z",
};

function setPlatform(platform: "android" | "ios" | "web") {
  Object.defineProperty(window, "Capacitor", {
    configurable: true,
    value: {
      isNativePlatform: () => platform !== "web",
      getPlatform: () => platform,
    },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function AccessConsumer({ testId }: { testId: string }) {
  const { isActive } = useReviewerAccess();
  return <span data-testid={testId}>{isActive ? "active" : "inactive"}</span>;
}

describe("Android reviewer access", () => {
  beforeEach(() => {
    localStorage.clear();
    setPlatform("android");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("posts the code once, stores only the permanent grant, and unlocks Android Plus", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, grant: GRANT }));
    vi.stubGlobal("fetch", fetchMock);

    const grant = await requestReviewerAccess("review-code");

    expect(grant).toEqual(GRANT);
    expect(fetchMock).toHaveBeenCalledWith(REVIEWER_ACCESS_URL, expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ code: "review-code" }),
      cache: "no-store",
    }));
    storeReviewerAccessGrant(grant);
    expect(readReviewerAccessGrant()).toEqual(GRANT);
    expect(localStorage.getItem(REVIEWER_ACCESS_STORAGE_KEY)).not.toContain("review-code");
    expect(isPremium("free", grant)).toBe(true);
  });

  it("updates sibling consumers immediately through storage synchronization", async () => {
    const view = render(
      <>
        <AccessConsumer testId="first" />
        <AccessConsumer testId="second" />
      </>
    );

    expect(view.getByTestId("first")).toHaveTextContent("inactive");
    expect(view.getByTestId("second")).toHaveTextContent("inactive");
    act(() => storeReviewerAccessGrant(GRANT));
    await waitFor(() => {
      expect(view.getByTestId("first")).toHaveTextContent("active");
      expect(view.getByTestId("second")).toHaveTextContent("active");
    });

    act(clearReviewerAccessGrant);
    await waitFor(() => expect(view.getByTestId("first")).toHaveTextContent("inactive"));
  });

  it("does not alter a paid subscription while reviewer access is stored separately", () => {
    const paidUser: UserData = { name: "Reviewer", units: "lbs", subscription: "premium" };
    localStorage.setItem("jotrea_user", JSON.stringify(paidUser));

    storeReviewerAccessGrant(GRANT);

    expect(JSON.parse(localStorage.getItem("jotrea_user")!)).toEqual(paidUser);
    expect(isPremium("premium", GRANT)).toBe(true);
  });

  it("does not let a cached premium subscription bypass a false iOS RevenueCat state", () => {
    expect(resolvePlusAccess({
      native: true,
      platform: "ios",
      revenueCatActive: false,
      cachedSubscription: "premium",
      reviewerGrantActive: false,
    })).toBe(false);
  });

  it("uses Android reviewer access when RevenueCat is free without manufacturing paid state", () => {
    const reviewerOnlyUser: UserData = { name: "Reviewer", units: "lbs", subscription: "free" };
    expect(resolvePlusAccess({
      native: true,
      platform: "android",
      revenueCatActive: false,
      cachedSubscription: reviewerOnlyUser.subscription,
      reviewerGrantActive: true,
    })).toBe(true);
    expect(reviewerOnlyUser.subscription).toBe("free");
  });

  it.each([
    [401, "That reviewer code is invalid."],
    [429, "Too many attempts. Please wait a moment and try again."],
    [503, "Reviewer access is not configured. Please try again later."],
  ])("handles HTTP %s without persisting access", async (status, message) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ok: false, error: message }, status)));

    await expect(requestReviewerAccess("wrong-code")).rejects.toThrow(message);
    expect(localStorage.getItem(REVIEWER_ACCESS_STORAGE_KEY)).toBeNull();
  });

  it("reports malformed JSON/CDN responses and network failures explicitly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new SyntaxError("HTML")),
    } as unknown as Response));
    await expect(requestReviewerAccess("code")).rejects.toThrow(
      "Reviewer access service returned an unreadable response."
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(requestReviewerAccess("code")).rejects.toThrow(
      "Could not reach reviewer access service."
    );
  });

  it("reports request timeouts without retaining the code", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })));
    const request = requestReviewerAccess("timeout-code");
    const timedOut = expect(request).rejects.toThrow("Reviewer access request timed out.");
    await vi.advanceTimersByTimeAsync(REVIEWER_ACCESS_TIMEOUT_MS);
    await timedOut;
    expect(localStorage.getItem(REVIEWER_ACCESS_STORAGE_KEY)).toBeNull();
  });

  it.each(["ios", "web"] as const)("rejects %s clients before making a request", async (platform) => {
    setPlatform(platform);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestReviewerAccess("code")).rejects.toThrow(
      "Reviewer access is only available in the Android app."
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isPremium("free", GRANT)).toBe(false);
  });
});