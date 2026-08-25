import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Health } from "@capgo/capacitor-health";
import {
  exportHealthKitWeights,
  HEALTHKIT_WEIGHT_EXPORT_STATE_KEY,
  isHealthKitAvailable,
  getHealthKitAuthorizationStatus,
  mergeHealthKitWeights,
  readHealthKitWeights,
  requestHealthKitAuthorization,
  writeHealthKitWeight,
} from "./healthKit";

vi.mock("@capgo/capacitor-health", () => ({
  Health: {
    isAvailable: vi.fn(),
    requestAuthorization: vi.fn(),
    checkAuthorization: vi.fn(),
    readSamples: vi.fn(),
    saveSample: vi.fn(),
  },
}));

describe("HealthKit service", () => {
  const health = Health as unknown as {
    isAvailable: ReturnType<typeof vi.fn>;
    requestAuthorization: ReturnType<typeof vi.fn>;
    checkAuthorization: ReturnType<typeof vi.fn>;
    readSamples: ReturnType<typeof vi.fn>;
    saveSample: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    health.isAvailable.mockResolvedValue({ available: true });
    health.requestAuthorization.mockResolvedValue({
      readAuthorized: ["weight"],
      readDenied: [],
      writeAuthorized: ["weight"],
      writeDenied: [],
    });
    health.checkAuthorization.mockResolvedValue({
      readAuthorized: ["weight"],
      readDenied: [],
      writeAuthorized: ["weight"],
      writeDenied: [],
    });
    health.readSamples.mockResolvedValue({
      samples: [
        { dataType: "weight", value: 90, unit: "kilogram", startDate: "2026-02-02T12:00:00.000Z", endDate: "2026-02-02T12:00:00.000Z" },
        { dataType: "weight", value: 91, unit: "kilogram", startDate: "2026-02-01T12:00:00.000Z", endDate: "2026-02-01T12:00:00.000Z" },
      ],
    });
    health.saveSample.mockResolvedValue(undefined);
  });

  it("requests body-mass read and write access", async () => {
    await expect(requestHealthKitAuthorization()).resolves.toBe("authorized");
    expect(health.requestAuthorization).toHaveBeenCalledWith({
      read: ["weight"],
      write: ["weight"],
    });
  });

  it("checks existing authorization without requesting permission", async () => {
    await expect(getHealthKitAuthorizationStatus()).resolves.toBe("authorized");
    expect(health.checkAuthorization).toHaveBeenCalledWith({
      read: ["weight"],
      write: ["weight"],
    });
    expect(health.requestAuthorization).not.toHaveBeenCalled();
  });

  it("reads sorted weight samples and writes validated weights", async () => {
    const start = new Date("2026-02-01T00:00:00.000Z");
    const end = new Date("2026-03-01T00:00:00.000Z");
    const samples = await readHealthKitWeights(start, end);
    expect(samples.map((sample) => sample.value)).toEqual([91, 90]);
    expect(health.readSamples).toHaveBeenCalledWith({
      dataType: "weight",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 500,
      ascending: true,
    });

    await expect(writeHealthKitWeight(88.5, "kg", end)).resolves.toBe(true);
    expect(health.saveSample).toHaveBeenCalledWith({
      dataType: "weight",
      value: 88.5,
      unit: "kilogram",
      startDate: end.toISOString(),
      endDate: end.toISOString(),
    });
    await expect(writeHealthKitWeight(220.462, "lb", end)).resolves.toBe(true);
    expect(health.saveSample).toHaveBeenLastCalledWith(expect.objectContaining({ value: 100 }));
    await expect(writeHealthKitWeight(0, "kg")).rejects.toThrow("positive");
  });

  it("is a safe no-op when the native plugin is unavailable", async () => {
    health.isAvailable.mockResolvedValue({ available: false });
    await expect(isHealthKitAvailable()).resolves.toBe(false);
    await expect(requestHealthKitAuthorization()).resolves.toBe("unavailable");
    await expect(readHealthKitWeights(new Date(0))).resolves.toEqual([]);
    await expect(writeHealthKitWeight(75, "kg")).resolves.toBe(false);
  });

  it("converts imported samples and makes repeated daily imports idempotent", () => {
    const existing = [{ id: "manual-1", date: "2026-02-01", weight: 200 }];
    const samples = [
      { value: 90, unit: "kg" as const, startDate: "2026-02-01T12:00:00.000Z", endDate: "2026-02-01T12:00:00.000Z" },
      { value: 91, unit: "kg" as const, startDate: "2026-02-02T12:00:00.000Z", endDate: "2026-02-02T12:00:00.000Z" },
      { value: 92, unit: "kg" as const, startDate: "2026-02-02T16:00:00.000Z", endDate: "2026-02-02T16:00:00.000Z" },
    ];

    const merged = mergeHealthKitWeights(existing, samples, "lbs");

    expect(merged).toEqual([
      existing[0],
      expect.objectContaining({
        id: "healthkit-2026-02-02-200.6",
        date: "2026-02-02",
        weight: 200.6,
        notes: "Imported from Apple Health",
      }),
    ]);
    expect(mergeHealthKitWeights(merged, samples, "lbs")).toEqual(merged);
  });

  describe("weight exports", () => {
    const weights = [
      { id: "weight-1", date: "2026-02-01", weight: 90 },
      { id: "weight-2", date: "2026-02-02", weight: 89 },
    ];

    it("exports each weight once, then skips unchanged entries", async () => {
      await expect(exportHealthKitWeights(weights, "kg")).resolves.toEqual({
        exported: 2,
        skipped: 0,
        failed: 0,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(2);

      await expect(exportHealthKitWeights(weights, "kg")).resolves.toEqual({
        exported: 0,
        skipped: 2,
        failed: 0,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(2);
    });

    it("exports a changed weight with its new fingerprint", async () => {
      await exportHealthKitWeights(weights, "kg");
      await expect(exportHealthKitWeights([{ ...weights[0], weight: 88 }, weights[1]], "kg")).resolves.toEqual({
        exported: 1,
        skipped: 1,
        failed: 0,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(3);
    });

    it("recovers from malformed persisted export state", async () => {
      localStorage.setItem(HEALTHKIT_WEIGHT_EXPORT_STATE_KEY, "{not json");
      await expect(exportHealthKitWeights(weights, "kg")).resolves.toEqual({
        exported: 2,
        skipped: 0,
        failed: 0,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(2);
    });

    it("does not mark failed writes exported and continues remaining entries", async () => {
      health.saveSample
        .mockRejectedValueOnce(new Error("HealthKit write failed"))
        .mockResolvedValueOnce(undefined);

      await expect(exportHealthKitWeights(weights, "kg")).resolves.toEqual({
        exported: 1,
        skipped: 0,
        failed: 1,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(2);

      await expect(exportHealthKitWeights(weights, "kg")).resolves.toEqual({
        exported: 1,
        skipped: 1,
        failed: 0,
      });
      expect(health.saveSample).toHaveBeenCalledTimes(3);
    });
  });
});