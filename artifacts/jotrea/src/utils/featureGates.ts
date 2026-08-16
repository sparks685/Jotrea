import type { DoseEntry, WeightEntry } from "@/types";

export const FREE_HISTORY_DAYS = 30;

export function isPremium(_subscription: string): boolean {
  return true; // free for launch — all features unlocked
}

export function getFreeHistoryCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - FREE_HISTORY_DAYS);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function filterForFreeTier<T extends { date: string }>(
  items: T[],
  subscription: string
): { visible: T[]; locked: T[] } {
  if (isPremium(subscription)) {
    return { visible: items, locked: [] };
  }
  const cutoff = getFreeHistoryCutoff();
  const visible = items.filter((i) => new Date(i.date) >= cutoff);
  const locked = items.filter((i) => new Date(i.date) < cutoff);
  return { visible, locked };
}

export function isCalendarMonthLocked(year: number, month: number, subscription: string): boolean {
  if (isPremium(subscription)) return false;
  const cutoff = getFreeHistoryCutoff();
  const lastDayOfMonth = new Date(year, month + 1, 0);
  return lastDayOfMonth < cutoff;
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
  share: (opts: { files: string[] }) => Promise<unknown>;
};
type CapGlobal = {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  // Capacitor v3+: native plugins are obtained via registerPlugin(), which
  // the native bridge injects. The old Plugins registry no longer lists
  // native-only plugins.
  registerPlugin?: (name: string) => unknown;
  Plugins?: { Filesystem?: CapFilesystem; Share?: CapShare };
};

function getCapacitor(): CapGlobal | undefined {
  return (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
}

/** True when running inside the native Capacitor shell (iOS/Android app). */
function isNativeApp(): boolean {
  return getCapacitor()?.isNativePlatform?.() === true;
}

// Cache registerPlugin proxies — registering the same plugin twice warns.
let capPluginCache: { fs: CapFilesystem; share: CapShare } | null = null;

function getCapacitorPlugins(): { fs: CapFilesystem; share: CapShare } {
  if (capPluginCache) return capPluginCache;
  const cap = getCapacitor();
  if (!cap) throw new Error("Capacitor global not found");

  // Capacitor v3+: obtain native plugins via registerPlugin (the bridge
  // injects it). Legacy Plugins registry as a last resort.
  const fs =
    typeof cap.registerPlugin === "function"
      ? (cap.registerPlugin("Filesystem") as CapFilesystem)
      : cap.Plugins?.Filesystem;
  const share =
    typeof cap.registerPlugin === "function"
      ? (cap.registerPlugin("Share") as CapShare)
      : cap.Plugins?.Share;
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
): Promise<void> {
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
    await share.share({ files: uris });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // User closed the share sheet — not an error.
    if (/cancel/i.test(message)) return;
    alert(`Export failed: ${message}`);
  }
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
  if (isNativeApp()) {
    await shareViaCapacitor(files);
    return true;
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

