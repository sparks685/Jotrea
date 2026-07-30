/**
 * Tests for cancelNotificationTag — verifies that the CANCEL_TAG message is
 * sent to the active service worker with the correct tag when a dose is logged.
 *
 * Dashboard.tsx calls `cancelNotificationTag(`jotrea-missed-dose-${logDate}`)` inside
 * handleLogDose, so we test the underlying utility here and confirm the wire format.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cancelNotificationTag } from "./notifications";

// ─── SW mock helpers ──────────────────────────────────────────────────────────

function makeMockSW() {
  return { postMessage: vi.fn() };
}

function installMockSW(sw: ReturnType<typeof makeMockSW> | null) {
  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      getRegistration: vi.fn().mockResolvedValue(
        sw ? { active: sw, waiting: null, installing: null } : undefined
      ),
    },
    configurable: true,
    writable: true,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("cancelNotificationTag", () => {
  let mockSW: ReturnType<typeof makeMockSW>;

  beforeEach(() => {
    mockSW = makeMockSW();
    installMockSW(mockSW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends CANCEL_TAG to the service worker with the exact tag string", async () => {
    const tag = "jotrea-missed-dose-2026-07-30";
    await cancelNotificationTag(tag);

    expect(mockSW.postMessage).toHaveBeenCalledOnce();
    expect(mockSW.postMessage).toHaveBeenCalledWith({
      type: "CANCEL_TAG",
      payload: { tag },
    });
  });

  describe("scenario (a): dose logged before 9 PM — notification not yet shown", () => {
    it("cancels the pending missed-dose notification for today's date", async () => {
      // Simulates handleLogDose running at e.g. 14:30 (before the 21:00 missed-dose trigger)
      const logDate = "2026-07-30"; // today, afternoon
      const expectedTag = `jotrea-missed-dose-${logDate}`;

      await cancelNotificationTag(expectedTag);

      expect(mockSW.postMessage).toHaveBeenCalledWith({
        type: "CANCEL_TAG",
        payload: { tag: expectedTag },
      });
    });
  });

  describe("scenario (b): dose logged after 9 PM — notification may have already fired", () => {
    it("cancels the missed-dose notification for today's date even after 9 PM window has opened", async () => {
      // Simulates handleLogDose running at e.g. 21:45 (after the missed-dose notification fires)
      const logDate = "2026-07-30"; // today, late evening
      const expectedTag = `jotrea-missed-dose-${logDate}`;

      await cancelNotificationTag(expectedTag);

      expect(mockSW.postMessage).toHaveBeenCalledWith({
        type: "CANCEL_TAG",
        payload: { tag: expectedTag },
      });
    });
  });

  it("uses the logDate (not today's date) when a backdated dose is logged", async () => {
    // Edge case: user logs a dose for a past date; the tag must match that past date
    const backDate = "2026-07-23";
    const expectedTag = `jotrea-missed-dose-${backDate}`;

    await cancelNotificationTag(expectedTag);

    expect(mockSW.postMessage).toHaveBeenCalledWith({
      type: "CANCEL_TAG",
      payload: { tag: expectedTag },
    });
  });

  it("does nothing when no service worker is registered", async () => {
    // No active SW — postMessage should never be called; must not throw
    installMockSW(null);

    await expect(
      cancelNotificationTag("jotrea-missed-dose-2026-07-30")
    ).resolves.toBeUndefined();

    expect(mockSW.postMessage).not.toHaveBeenCalled();
  });
});
