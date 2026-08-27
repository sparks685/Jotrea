import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserData } from "@/types";

const { getStatus, setUser } = vi.hoisted(() => ({
  getStatus: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@/services/subscriptionService", () => ({
  subscriptionService: { getStatus },
}));
vi.mock("@/utils/capacitor", () => ({
  isNativeCapacitor: () => true,
}));
vi.mock("@/hooks/useMedication", () => ({
  useUser: () => ({ setUser }),
  useMedication: () => ({ medication: null }),
  useOralDoseMigration: vi.fn(),
}));

import { NativeSubscriptionSync } from "@/App";

describe("NativeSubscriptionSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStatus.mockResolvedValue({ state: "free", isPlus: false });
    setUser.mockImplementation((update: (current: UserData) => UserData) =>
      update({ name: "Test", units: "lbs", subscription: "premium" })
    );
  });

  it("syncs once at launch and once per visible event without looping after persistence", async () => {
    const { rerender } = render(<NativeSubscriptionSync />);

    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));
    rerender(<NativeSubscriptionSync />);
    await act(async () => Promise.resolve());
    expect(getStatus).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(2));
  });

  it("does not overlap foreground refreshes", async () => {
    let resolveStatus!: (status: { state: "free"; isPlus: false }) => void;
    getStatus.mockReturnValue(new Promise((resolve) => {
      resolveStatus = resolve;
    }));

    render(<NativeSubscriptionSync />);
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(getStatus).toHaveBeenCalledTimes(1);

    resolveStatus({ state: "free", isPlus: false });
    await act(async () => Promise.resolve());
  });
});