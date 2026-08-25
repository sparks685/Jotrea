import { afterEach, describe, expect, it, vi } from "vitest";
import { exportCSVFiles } from "./featureGates";

describe("native CSV export", () => {
  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
    vi.restoreAllMocks();
  });

  it("writes CSVs as real files before opening the native share sheet", async () => {
    const writeFile = vi
      .fn()
      .mockResolvedValueOnce({ uri: "file:///dose-history.csv" })
      .mockResolvedValueOnce({ uri: "file:///weight-history.csv" });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "Capacitor", {
      configurable: true,
      value: {
        isNativePlatform: () => true,
        isPluginAvailable: () => true,
        registerPlugin: (name: string) =>
          name === "Filesystem" ? { writeFile } : { share },
      },
    });

    await expect(
      exportCSVFiles([
        { filename: "dose-history.csv", content: "Date,Dose\n2026-01-01,5" },
        { filename: "weight-history.csv", content: "Date,Weight\n2026-01-01,80" },
      ])
    ).resolves.toBe(true);

    expect(writeFile).toHaveBeenNthCalledWith(1, {
      path: "dose-history.csv",
      data: "Date,Dose\n2026-01-01,5",
      directory: "DOCUMENTS",
      encoding: "utf8",
    });
    expect(share).toHaveBeenCalledWith({
      files: ["file:///dose-history.csv", "file:///weight-history.csv"],
    });
  });
});