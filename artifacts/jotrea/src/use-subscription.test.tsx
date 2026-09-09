import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserData } from "@/types";

const { getProducts, getStatus, purchase, restore, setUser } = vi.hoisted(() => ({
  getProducts: vi.fn(),
  getStatus: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/services/subscriptionService", () => ({
  subscriptionService: { getProducts, getStatus, purchase, restore },
}));

vi.mock("@/hooks/useMedication", () => ({
  useUser: () => ({ setUser }),
}));

import { useSubscription } from "@/hooks/useSubscription";

describe("useSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProducts.mockResolvedValue([]);
    getStatus.mockResolvedValue({
      state: "trial",
      isPlus: true,
      productId: "com.jotrea.app.plus.monthly",
      expiresAt: "2026-09-09T00:00:00.000Z",
    });
  });

  it("persists an automatically refreshed Plus entitlement for Settings", async () => {
    renderHook(() => useSubscription());

    await waitFor(() => expect(setUser).toHaveBeenCalledTimes(1));
    const update = setUser.mock.calls[0][0] as (current: UserData) => UserData;
    const next = update({
      name: "Test",
      units: "lbs",
      subscription: "free",
    } as UserData);

    expect(next).toMatchObject({
      subscription: "premium",
      subscriptionProductId: "com.jotrea.app.plus.monthly",
      subscriptionExpiresAt: "2026-09-09T00:00:00.000Z",
      trialEndDate: "2026-09-09T00:00:00.000Z",
    });
  });
});