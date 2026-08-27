import type { DoseEntry, WeightEntry } from "@/types";
import { Directory, Encoding, type FilesystemPlugin } from "@capacitor/filesystem";
import type { SharePlugin } from "@capacitor/share";
import { getNativePlugin, isNativeCapacitor } from "./capacitor";

export const FREE_HISTORY_DAYS = 30;
export const CSV_EXPORT_FILENAMES = {
  doses: "jotrea-doses.csv",
  weights: "jotrea-weights.csv",
  symptoms: "jotrea-symptoms.csv",
} as const;

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
  let s = val == null ? "" : String(val);
  // Prevent spreadsheet applications from interpreting user-entered text as
  // a formula when a recipient opens the export.
  if (/^[\s\u0000-\u001F]*[=+\-@]/.test(s)) s = `'${s}`;
  return s.includes(",") || s.includes('"') || /[\r\n\t]/.test(s)
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

export function buildSymptomCSV(doses: DoseEntry[]): string {
  const header = ["Date", "Time", "Symptom", "Dose (mg)", "Notes"].join(",");
  const rows = [...doses]
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .flatMap((dose) =>
      (dose.sideEffects ?? [])
        .map((symptom) => symptom.trim())
        .filter((symptom) => symptom && symptom.toLowerCase() !== "none")
        .map((symptom) =>
          [dose.date, dose.time, symptom, dose.doseAmount, dose.notes]
            .map(escapeCsv)
            .join(",")
        )
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
type CapFilesystem = Pick<FilesystemPlugin, "writeFile" | "deleteFile">;
type CapShare = Pick<SharePlugin, "share">;
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
export type ExportFile = {
  filename: string;
  content: string;
  mimeType?: string;
  contentType?: string;
  encoding?: "utf8" | "base64";
};

async function shareViaCapacitor(
  files: ExportFile[]
): Promise<boolean> {
  const isCancel = (err: unknown) =>
    /cancel/i.test(err instanceof Error ? err.message : String(err));

  try {
    const { fs, share } = getCapacitorPlugins();
    const uris: string[] = [];
    try {
      for (const f of files) {
        const { uri } = await fs.writeFile({
          path: f.filename,
          data: f.content,
          // Documents is required for reliable UIActivityViewController access
          // on iOS. Files are deleted immediately after the share sheet closes.
          directory: Directory.Documents,
          encoding: f.encoding === "base64" ? undefined : Encoding.UTF8,
        });
        uris.push(uri);
      }
      try {
        // The real filename extension lets iOS resolve public.comma-separated-
        // values-text for CSV and com.adobe.pdf for PDF.
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
    } finally {
      await Promise.allSettled(files.map((file) =>
        fs.deleteFile({ path: file.filename, directory: Directory.Documents })
      ));
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
  return exportFiles(files.map((file) => ({
    ...file,
    mimeType: "text/csv",
    contentType: "public.comma-separated-values-text",
  })));
}

export async function exportFiles(files: ExportFile[]): Promise<boolean> {
  if (isNativeCapacitor()) {
    if (await shareViaCapacitor(files)) return true;
  }
  const shareFiles = files.map(
    (f) => {
      const data = f.encoding === "base64"
        ? Uint8Array.from(atob(f.content), (character) => character.charCodeAt(0))
        : f.content;
      return new File([data], f.filename, { type: f.mimeType })
    }
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
    setTimeout(() => {
      const data = f.encoding === "base64"
        ? Uint8Array.from(atob(f.content), (character) => character.charCodeAt(0))
        : f.content;
      const blob = new Blob([data], { type: f.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = f.filename;
      link.click();
      URL.revokeObjectURL(url);
    }, i * 300);
  }
  return true;
}

