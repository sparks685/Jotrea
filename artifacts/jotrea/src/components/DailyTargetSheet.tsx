import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { format, parseISO, addDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, Pencil, Trash2, Undo2, Check, History, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DailyTargetsApi } from "@/hooks/useDailyTargets";
import type { AmountEntry, DailyTargetGoals, DailyTargetKey } from "@/types/dailyTargets";
import {
  MAX_PROTEIN_G,
  MAX_STEPS,
  MAX_WATER_ML,
  computeProgress,
  formatCups,
  isLoggableDate,
  sumEntries,
} from "@/utils/dailyTargets";

const TITLES: Record<DailyTargetKey, string> = { water: "Water", protein: "Protein", steps: "Steps" };

interface Props {
  target: DailyTargetKey | null;
  onClose: () => void;
  api: DailyTargetsApi;
  goals: DailyTargetGoals;
}

export function DailyTargetSheet({ target, onClose, api, goals }: Props) {
  if (typeof document === "undefined" || !target) return null;
  return createPortal(<SheetBody key={target} target={target} onClose={onClose} api={api} goals={goals} />, document.body);
}

function SheetBody({ target, onClose, api, goals }: Props & { target: DailyTargetKey }) {
  const titleId = useId();
  const [date, setDate] = useState(api.today);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [cupDraft, setCupDraft] = useState(String(api.cupMl));
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const day = api.getDay(date);
  const progress = computeProgress(day, goals, api.cupMl)[target];
  const isToday = date === api.today;
  const entries: AmountEntry[] = target === "steps" ? [] : day[target];
  const [stepsDraft, setStepsDraft] = useState(day.steps !== null ? String(day.steps) : "");

  useEffect(() => {
    setStepsDraft(day.steps !== null ? String(day.steps) : "");
  }, [date, day.steps]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  // If the user was viewing "today" when midnight passes, follow the new day.
  const lastToday = useRef(api.today);
  useEffect(() => {
    if (lastToday.current !== api.today) {
      setDate((d) => (d === lastToday.current ? api.today : d));
      lastToday.current = api.today;
    }
  }, [api.today]);

  const unit = target === "water" ? "mL" : target === "protein" ? "g" : "steps";
  const max = target === "water" ? MAX_WATER_ML : target === "protein" ? MAX_PROTEIN_G : MAX_STEPS;

  const parse = (v: string) => {
    const n = Number(v.trim());
    if (!v.trim() || !Number.isFinite(n) || n <= 0) return null;
    if (n > max) return null;
    return n;
  };

  const addCustom = () => {
    const n = parse(custom);
    if (n === null) {
      setError(`Enter an amount between 1 and ${max.toLocaleString()} ${unit}.`);
      return;
    }
    if (target === "steps") return;
    api.addAmount(date, target, n, `Added ${n} ${unit}`);
    setCustom("");
    setError("");
  };

  const saveSteps = () => {
    const n = Number(stepsDraft.trim());
    if (!stepsDraft.trim() || !Number.isInteger(n) || n < 0 || n > MAX_STEPS) {
      setError(`Enter a whole number from 0 to ${MAX_STEPS.toLocaleString()}.`);
      return;
    }
    api.setSteps(date, n);
    setError("");
  };

  const saveEdit = (id: string) => {
    if (target === "steps") return;
    const n = parse(editValue);
    if (n === null) {
      setError(`Enter an amount between 1 and ${max.toLocaleString()} ${unit}.`);
      return;
    }
    api.updateAmount(date, target, id, n);
    setEditingId(null);
    setError("");
  };

  const saveCup = () => {
    const n = Number(cupDraft);
    if (!Number.isFinite(n) || n < 30 || n > 2000) {
      setError("Cup size must be between 30 and 2000 mL.");
      return;
    }
    api.setCupMl(n);
    setError("");
  };

  const summary =
    target === "water"
      ? `${formatCups(progress.current)} of ${goals.waterCups} cups`
      : target === "protein"
      ? `${progress.current} g${goals.proteinG ? ` of ${goals.proteinG} g` : ""}`
      : `${progress.current.toLocaleString()} of ${goals.steps.toLocaleString()} steps`;

  const quick =
    target === "water"
      ? [
          { label: "½ cup", amount: api.cupMl / 2 },
          { label: "1 cup", amount: api.cupMl },
          { label: "2 cups", amount: api.cupMl * 2 },
        ]
      : target === "protein"
      ? [5, 10, 20, 30].map((g) => ({ label: `+${g} g`, amount: g }))
      : [];

  const entryLabel = (e: AmountEntry) =>
    target === "water" ? `${formatCups(e.amount / api.cupMl)} cups · ${Math.round(e.amount)} mL` : `${e.amount} g`;

  return (
    <div
      className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[60] flex items-end"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      data-testid="daily-target-sheet-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={`daily-target-sheet-${target}`}
        className="w-full max-w-md mx-auto bg-card text-foreground rounded-t-3xl flex flex-col border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300"
        style={{ maxHeight: "88dvh" }}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-3 flex-shrink-0">
          <div>
            <h3 id={titleId} className="text-lg font-bold">Log {TITLES[target]}</h3>
            <p className="text-xs text-muted-foreground" data-testid="text-sheet-summary">
              {summary}
              {progress.complete && (progress.legacyOnly ? " · Legacy checkmark" : " · Goal reached")}
            </p>
          </div>
          <button type="button" ref={closeRef} className="p-2 rounded-xl bg-muted" onClick={onClose} aria-label="Close" data-testid="button-close-daily-target">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Date navigation */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-shrink-0">
          <button type="button"
            className="p-2 rounded-xl border border-border"
            aria-label="Previous day"
            onClick={() => setDate(format(addDays(parseISO(date), -1), "yyyy-MM-dd"))}
            data-testid="button-prev-day"
          >
            <ChevronLeft size={16} />
          </button>
          <label className="flex-1">
            <span className="sr-only">Record date</span>
            <Input
              type="date"
              value={date}
              max={api.today}
              onChange={(e) => isLoggableDate(e.target.value, api.today) && setDate(e.target.value)}
              className="h-10 rounded-xl text-center"
              data-testid="input-target-date"
            />
          </label>
          <button type="button"
            className="p-2 rounded-xl border border-border disabled:opacity-40"
            aria-label="Next day"
            disabled={isToday}
            onClick={() => {
              const next = format(addDays(parseISO(date), 1), "yyyy-MM-dd");
              if (isLoggableDate(next, api.today)) setDate(next);
            }}
            data-testid="button-next-day"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-4 pb-4 overscroll-contain">
          <div
            className="h-2 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-label={`${TITLES[target]} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
          >
            <div className="h-full bg-secondary origin-left transition-transform duration-500" style={{ transform: `scaleX(${progress.ratio})` }} />
          </div>

          {api.dataWarning && (
            <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 flex gap-2" data-testid="warning-malformed-data">
              <AlertTriangle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80">
                Some saved target records could not be read and are hidden. A copy of the original data was kept on this device before any changes.
              </p>
            </div>
          )}

          {day.legacy?.[target] && (
            <div className="rounded-2xl border border-border bg-muted/40 p-3 flex items-center justify-between gap-3" data-testid="legacy-completion">
              <p className="text-xs text-muted-foreground">
                Legacy checkmark from an earlier version of Jotrea. No amount was recorded, and the date was saved in UTC, so it may be one day off from your local calendar. It is kept as originally recorded.
              </p>
              <button type="button" className="text-xs font-semibold text-primary underline underline-offset-2 flex-shrink-0" onClick={() => api.clearLegacy(date, target)} data-testid="button-clear-legacy">
                Remove
              </button>
            </div>
          )}

          {target === "steps" ? (
            <div className="space-y-2">
              <label htmlFor="steps-total" className="text-sm font-semibold">
                Total steps for {isToday ? "today" : format(parseISO(date), "MMM d")}
              </label>
              <p className="text-xs text-muted-foreground">Enter the day's total. This replaces any earlier value.</p>
              <div className="flex gap-2">
                <Input
                  id="steps-total"
                  inputMode="numeric"
                  enterKeyHint="done"
                  value={stepsDraft}
                  onChange={(e) => setStepsDraft(e.target.value.replace(/[^\d]/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && saveSteps()}
                  placeholder="e.g. 6420"
                  className="h-12 rounded-xl"
                  data-testid="input-steps-total"
                />
                <Button type="button" className="h-12 rounded-xl px-5" onClick={saveSteps} data-testid="button-save-steps">Save</Button>
              </div>
              {day.steps !== null && (
                <button type="button" className="text-xs text-destructive underline underline-offset-2" onClick={() => api.setSteps(date, null)} data-testid="button-clear-steps">
                  Clear steps for this day
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {quick.map((q) => (
                  <button type="button"
                    key={q.label}
                    onClick={() => api.addAmount(date, target, q.amount, `Added ${q.label}`)}
                    className="h-12 rounded-2xl border-2 border-border bg-background text-sm font-semibold hover:border-secondary active:scale-95 transition-all"
                    aria-label={`Add ${q.label}${target === "water" ? ` (${Math.round(q.amount)} mL)` : ""}`}
                    data-testid={`button-quick-${target}-${q.amount}`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <label htmlFor="custom-amount" className="text-sm font-semibold">Custom amount ({unit})</label>
                <div className="flex gap-2">
                  <Input
                    id="custom-amount"
                    inputMode="decimal"
                    enterKeyHint="done"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustom()}
                    className="h-12 rounded-xl"
                    placeholder={target === "water" ? "e.g. 350" : "e.g. 25"}
                    data-testid="input-custom-amount"
                  />
                  <Button type="button" className="h-12 rounded-xl px-5" onClick={addCustom} data-testid="button-add-custom">Add</Button>
                </div>
              </div>
              {target === "water" && (
                <div className="space-y-1">
                  <label htmlFor="cup-size" className="text-sm font-semibold">Cup size (mL)</label>
                  <p className="text-xs text-muted-foreground">Your cups goal and quick adds use this size.</p>
                  <div className="flex gap-2">
                    <Input
                      id="cup-size"
                      inputMode="numeric"
                      value={cupDraft}
                      onChange={(e) => setCupDraft(e.target.value.replace(/[^\d]/g, ""))}
                      className="h-10 rounded-xl"
                      data-testid="input-cup-size"
                    />
                    <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={saveCup} data-testid="button-save-cup-size">Set</Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Entries · {target === "water" ? `${Math.round(sumEntries(entries))} mL` : `${sumEntries(entries)} g`}
                </p>
                {entries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3 text-center rounded-2xl border border-dashed border-border" data-testid="text-no-entries">
                    Nothing logged for this day yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {entries.map((e) => (
                      <li key={e.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2" data-testid={`row-entry-${e.id}`}>
                        {editingId === e.id ? (
                          <>
                            <label className="sr-only" htmlFor={`edit-${e.id}`}>Edit amount in {unit}</label>
                            <Input
                              id={`edit-${e.id}`}
                              autoFocus
                              inputMode="decimal"
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              onKeyDown={(ev) => ev.key === "Enter" && saveEdit(e.id)}
                              className="h-9 rounded-lg flex-1"
                              data-testid={`input-edit-${e.id}`}
                            />
                            <button type="button" className="p-2 rounded-lg bg-secondary/10" aria-label="Save entry" onClick={() => saveEdit(e.id)} data-testid={`button-save-edit-${e.id}`}>
                              <Check size={14} className="text-secondary" />
                            </button>
                            <button type="button" className="p-2 rounded-lg bg-muted" aria-label="Cancel edit" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-${e.id}`}>
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{entryLabel(e)}</span>
                            <span className="text-[11px] text-muted-foreground">{format(parseISO(e.loggedAt), "h:mm a")}</span>
                            <button type="button"
                              className="p-2 rounded-lg hover:bg-muted"
                              aria-label={`Edit ${entryLabel(e)}`}
                              onClick={() => { setEditingId(e.id); setEditValue(String(e.amount)); }}
                              data-testid={`button-edit-${e.id}`}
                            >
                              <Pencil size={14} className="text-muted-foreground" />
                            </button>
                            <button type="button"
                              className="p-2 rounded-lg hover:bg-destructive/10"
                              aria-label={`Delete ${entryLabel(e)}`}
                              onClick={() => api.deleteAmount(date, target, e.id)}
                              data-testid={`button-delete-${e.id}`}
                            >
                              <Trash2 size={14} className="text-destructive" />
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {error && <p role="alert" className="text-xs text-destructive" data-testid="text-target-error">{error}</p>}

          <div>
            <button type="button"
              className="flex items-center gap-1.5 text-xs font-semibold text-primary"
              onClick={() => setShowHistory((s) => !s)}
              aria-expanded={showHistory}
              data-testid="button-toggle-history"
            >
              <History size={14} /> {showHistory ? "Hide history" : "View history"}
            </button>
            {showHistory && (
              <ul className="mt-2 space-y-1" data-testid="list-history">
                {api.historyDates.length === 0 && <li className="text-xs text-muted-foreground">No records yet.</li>}
                {api.historyDates.slice(0, 30).map((d) => {
                  const p = computeProgress(api.getDay(d), goals, api.cupMl)[target];
                  const text = p.legacyOnly
                    ? "Legacy checkmark"
                    : target === "water" ? `${formatCups(p.current)} cups` : target === "protein" ? `${p.current} g` : `${p.current.toLocaleString()} steps`;
                  return (
                    <li key={d}>
                      <button type="button"
                        onClick={() => setDate(d)}
                        className={`w-full flex justify-between rounded-lg px-3 py-2 text-sm ${d === date ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
                        data-testid={`button-history-${d}`}
                      >
                        <span>{d === api.today ? "Today" : format(parseISO(d), "EEE, MMM d")}</span>
                        <span className="text-muted-foreground">{text}{p.complete ? " · done" : ""}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {api.undo && (
          <div className="mx-6 mb-2 flex items-center justify-between rounded-2xl bg-foreground text-background px-4 py-2.5" role="status" data-testid="undo-bar">
            <span className="text-sm">{api.undo.label}</span>
            <button type="button" className="flex items-center gap-1 text-sm font-semibold" onClick={api.undoLast} data-testid="button-undo">
              <Undo2 size={14} /> Undo
            </button>
          </div>
        )}
        <div style={{ height: "max(1rem, env(safe-area-inset-bottom))" }} className="flex-shrink-0" />
      </div>
    </div>
  );
}
