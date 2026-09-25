import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { DailyTargetDay, DailyTargetStore } from "@/types/dailyTargets";
import {
  DAILY_TARGETS_BACKUP_KEY,
  DAILY_TARGETS_KEY,
  MAX_STEPS,
  isLoggableDate,
  sanitizeStoreWithReport,
  LEGACY_CHECKIN_KEY,
  emptyDay,
  emptyStore,
  localDateKey,
  mergeLegacyCheckin,
  newEntryId,
} from "@/utils/dailyTargets";

interface UndoState {
  label: string;
  date: string;
  previous: DailyTargetDay | null;
}

/** Tracks the local calendar date, rolling over at midnight and on return to the app. */
export function useLocalToday() {
  const [today, setToday] = useState(localDateKey);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === localDateKey() ? prev : localDateKey()));
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1).getTime() - now.getTime();
    const timeout = window.setTimeout(check, midnight);
    const interval = window.setInterval(check, 60_000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", check);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", check);
    };
  }, [today]);
  return today;
}

function readLegacy(): unknown {
  try {
    const raw = localStorage.getItem(LEGACY_CHECKIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useDailyTargets() {
  const today = useLocalToday();
  const [raw, setRaw] = useLocalStorage<DailyTargetStore>(DAILY_TARGETS_KEY, emptyStore());
  const [undo, setUndo] = useState<UndoState | null>(null);

  const store = useMemo(() => mergeLegacyCheckin(sanitizeStoreWithReport(raw).store, readLegacy()), [raw]);

  /** Raw persisted string + whether it contains malformed values. */
  const inspectRaw = () => {
    let text: string | null = null;
    try { text = localStorage.getItem(DAILY_TARGETS_KEY); } catch { return { text: null, malformed: false, parsed: null }; }
    if (!text) return { text, malformed: false, parsed: null };
    try {
      const parsed = JSON.parse(text);
      return { text, malformed: sanitizeStoreWithReport(parsed).issues > 0, parsed };
    } catch {
      return { text, malformed: true, parsed: null };
    }
  };

  const [dataWarning, setDataWarning] = useState(() => inspectRaw().malformed);

  /**
   * Freshest persisted store. Before overwriting malformed data, the original
   * raw text is copied once to a local backup key so nothing is silently lost.
   */
  const readFresh = () => {
    const { text, malformed, parsed } = inspectRaw();
    if (malformed && text) {
      try {
        if (!localStorage.getItem(DAILY_TARGETS_BACKUP_KEY)) {
          localStorage.setItem(DAILY_TARGETS_BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), raw: text }));
        }
      } catch { /* storage full: still proceed with in-memory view */ }
      setDataWarning(true);
    }
    const base = text ? sanitizeStoreWithReport(parsed).store : store;
    return mergeLegacyCheckin(base, readLegacy());
  };

  const getDay = useCallback((date: string) => store.days[date] ?? emptyDay(date), [store]);

  const writeDay = (date: string, label: string, mutate: (d: DailyTargetDay) => DailyTargetDay) => {
    if (!isLoggableDate(date, localDateKey())) return false;
    const base = readFresh();
    const previous = base.days[date] ?? null;
    const next = mutate(previous ?? emptyDay(date));
    setRaw({ ...base, days: { ...base.days, [date]: next } });
    setUndo({ label, date, previous });
    return true;
  };

  const now = () => new Date().toISOString();

  const addAmount = (date: string, key: "water" | "protein", amount: number, label: string) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    writeDay(date, label, (d) => ({ ...d, [key]: [...d[key], { id: newEntryId(), amount, loggedAt: now() }] }));
  };

  const updateAmount = (date: string, key: "water" | "protein", id: string, amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    writeDay(date, "Entry updated", (d) => ({ ...d, [key]: d[key].map((e) => (e.id === id ? { ...e, amount } : e)) }));
  };

  const deleteAmount = (date: string, key: "water" | "protein", id: string) => {
    writeDay(date, "Entry deleted", (d) => ({ ...d, [key]: d[key].filter((e) => e.id !== id) }));
  };

  const setSteps = (date: string, steps: number | null) => {
    if (steps !== null && (!Number.isInteger(steps) || steps < 0 || steps > MAX_STEPS)) return;
    writeDay(date, steps === null ? "Steps cleared" : "Steps saved", (d) => ({ ...d, steps }));
  };

  const clearLegacy = (date: string, key: "water" | "protein" | "steps") => {
    writeDay(date, "Checkmark removed", (d) => (d.legacy ? { ...d, legacy: { ...d.legacy, [key]: false } } : d));
  };

  const setCupMl = (cupMl: number) => {
    if (!Number.isFinite(cupMl) || cupMl <= 0 || cupMl > 2000) return;
    const base = readFresh();
    setRaw({ ...base, cupMl: Math.round(cupMl) });
  };

  const undoLast = () => {
    if (!undo) return;
    const base = readFresh();
    const days = { ...base.days };
    if (undo.previous) days[undo.date] = undo.previous;
    else delete days[undo.date];
    setRaw({ ...base, days });
    setUndo(null);
  };

  const historyDates = useMemo(
    () => Object.keys(store.days).filter((d) => d <= today).sort().reverse(),
    [store, today],
  );

  return {
    today,
    cupMl: store.cupMl,
    getDay,
    historyDates,
    addAmount,
    updateAmount,
    deleteAmount,
    setSteps,
    clearLegacy,
    setCupMl,
    undo,
    undoLast,
    dismissUndo: () => setUndo(null),
    dataWarning,
  };
}

export type DailyTargetsApi = ReturnType<typeof useDailyTargets>;
