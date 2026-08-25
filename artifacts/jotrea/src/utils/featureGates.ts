import type { DoseEntry, WeightEntry } from "@/types";
import { getNativePlugin, isNativeCapacitor } from "./capacitor";

export const FREE_HISTORY_DAYS = 30;

export function isPremium(_subscription: string): boolean {
  return _subscription === "premium";
}

export function getFreeHistoryCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - FREE_HISTORY_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterForFreeTier<T extends { date: string }>(
  items: T[],
  _subscription: string
): { visible: T[]; locked: T[] } {
  // Personal tracking history is an essential free feature. Keep the legacy
  // return shape so existing consumers remain compatible, but never lock it.
  return { visible: items, locked: [] };
}

export function isCalendarMonthLocked(_year: number, _month: number, _subscription: string): boolean {
  return false;
}

function escapeCsv(val: string | number | undefined): string {
  const s = val == null ? "" : String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function buildDoseCSV(doses: DoseEntry[]): string {
  const header = ["Date", "Time", "Dose (mg)", "Site", "Notes", "Taken"].join(",");
  const rows = [...doses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) =>
      [d.date, d.time, d.doseAmount, d.site, d.notes, d.taken ? "Yes" : "No"]
        .map(escapeCsv)
        .join(",")
    );
  return [header, ...rows].join("\n");
}

export function buildWeightCSV(weights: WeightEntry[], units: string): string {
  const header = ["Date", `Weight (${units})`, "Notes"].join(",");
  const rows = [...weights]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) =>
      [w.date, w.weight, (w as WeightEntry & { notes?: string }).notes ?? ""]
        .map(escapeCsv)
        .join(",")
    );
  return [header, ...rows].join("\n");
}

export function downloadCSV(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Native (Capacitor) share path. WKWebView's Web Share API strips filenames
 * and MIME types, so shared CSVs show up as a "Plain Text" blob. When the app
 * runs inside a Capacitor shell with the Share + Filesystem plugins installed,
 * write each CSV to a real temp file and hand the file URLs to the native
 * share sheet (UIActivityViewController) so filenames and .csv icons survive.
 * Returns true if the native share handled it, false to fall through.
 */
type CapFilesystem = {
  writeFile: (opts: {
    path: string;
    data: string;
    directory: string;
    encoding: string;
  }) => Promise<{ uri: string }>;
};
type CapShare = {
  share: (opts: { files?: string[]; url?: string }) => Promise<unknown>;
};
// Cache registerPlugin proxies — registering the same plugin twice warns.
let capPluginCache: { fs: CapFilesystem; share: CapShare } | null = null;

function getCapacitorPlugins(): { fs: CapFilesystem; share: CapShare } {
  if (capPluginCache) return capPluginCache;
  const fs = getNativePlugin<CapFilesystem>("Filesystem");
  const share = getNativePlugin<CapShare>("Share");
  if (!fs || !share) {
    throw new Error(
      "Share/Filesystem plugins not found (registerPlugin unavailable)"
    );
  }
  capPluginCache = { fs, share };
  return capPluginCache;
}

/**
 * Native share. Called ONLY when running inside the Capacitor app; never
 * falls back to the web share path — a failure surfaces its real error so
 * it can be diagnosed on-device instead of silently degrading to a
 * filename-less "Plain Text" web share.
 */
async function shareViaCapacitor(
  files: { filename: string; content: string }[]
): Promise<boolean> {
  const isCancel = (err: unknown) =>
    /cancel/i.test(err instanceof Error ? err.message : String(err));

  try {
    const { fs, share } = getCapacitorPlugins();
    const uris: string[] = [];
    for (const f of files) {
      const { uri } = await fs.writeFile({
        path: f.filename,
        data: f.content,
        // Documents, not Cache: iOS blocks share-sheet access to
        // Library/Caches ("error fetching item for URL").
        directory: "DOCUMENTS",
        encoding: "utf8",
      });
      uris.push(uri);
    }
    try {
      // Preferred: one share sheet with all files.
      await share.share({ files: uris });
    } catch (multiErr) {
      if (isCancel(multiErr)) return true;
      // Some iOS versions/extensions reject multi-file shares — retry one
      // file at a time using the single-file `url` form.
      for (const uri of uris) {
        try {
          await share.share({ url: uri });
        } catch (singleErr) {
          if (isCancel(singleErr)) return true;
          throw singleErr;
        }
      }
    }
  } catch (err) {
    if (isCancel(err)) return true;
    console.warn("[Jotrea] Native CSV share failed; using browser fallback:", err);
    return false;
  }
  return true;
}

/**
 * Export CSV files. Inside the native app, ALWAYS use the Capacitor share
 * sheet (proper file names + .csv icons) — never the web share, which strips
 * filenames in WKWebView. In browsers, use the Web Share API with files when
 * available, otherwise regular downloads.
 * Returns true if the export was handed to the user (shared or downloaded).
 */
export async function exportCSVFiles(
  files: { filename: string; content: string }[]
): Promise<boolean> {
  if (isNativeCapacitor()) {
    if (await shareViaCapacitor(files)) return true;
  }
  const shareFiles = files.map(
    (f) => new File([f.content], f.filename, { type: "text/csv" })
  );
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  if (typeof nav.share === "function" && nav.canShare?.({ files: shareFiles })) {
    try {
      await nav.share({ files: shareFiles });
      return true;
    } catch (err) {
      // AbortError = user closed the share sheet; treat as handled.
      if (err instanceof DOMException && err.name === "AbortError") return true;
      // Otherwise fall through to download fallback.
    }
  }
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    setTimeout(() => downloadCSV(f.filename, f.content), i * 300);
  }
  return true;
}

