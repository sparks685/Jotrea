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

// Cache registerPlugin proxies — registering the same plugin twice warns.
let capPluginCache: { fs: CapFilesystem; share: CapShare } | null = null;

function getCapacitorPlugins(): { fs: CapFilesystem; share: CapShare } | null {
  if (capPluginCache) return capPluginCache;
  const cap = (window as unknown as { Capacitor?: CapGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;

  let fs: CapFilesystem | undefined;
  let share: CapShare | undefined;
  if (typeof cap.registerPlugin === "function") {
    if (cap.isPluginAvailable?.("Filesystem") !== false) {
      fs = cap.registerPlugin("Filesystem") as CapFilesystem;
    }
    if (cap.isPluginAvailable?.("Share") !== false) {
      share = cap.registerPlugin("Share") as CapShare;
    }
  }
  // Legacy (Capacitor 2) fallback.
  fs = fs ?? cap.Plugins?.Filesystem;
  share = share ?? cap.Plugins?.Share;

  if (!fs || !share) return null;
  capPluginCache = { fs, share };
  return capPluginCache;
}

async function shareViaCapacitor(
  files: { filename: string; content: string }[]
): Promise<boolean> {
  const plugins = getCapacitorPlugins();
  if (!plugins) return false;
  const { fs, share } = plugins;

  try {
    const uris: string[] = [];
    for (const f of files) {
      const { uri } = await fs.writeFile({
        path: f.filename,
        data: f.content,
        directory: "CACHE",
        encoding: "utf8",
      });
      uris.push(uri);
    }
    await share.share({ files: uris });
    return true;
  } catch (err) {
    // User cancelled the native share sheet — still handled.
    if (
      err instanceof Error &&
      /cancel/i.test(err.message)
    ) {
      return true;
    }
    // Plugin missing/failed — fall through to the web share path.
    return false;
  }
}

/**
 * Export CSV files. Prefers the native Capacitor share sheet (proper file
 * names + .csv icons), then the Web Share API with files, then regular
 * browser downloads.
 * Returns true if the export was handed to the user (shared or downloaded).
 */
export async function exportCSVFiles(
  files: { filename: string; content: string }[]
): Promise<boolean> {
  if (await shareViaCapacitor(files)) return true;
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

