import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Trash2, X, List, CalendarDays, CheckCircle2, FlaskConical, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMedication, useDoses } from "@/hooks/useMedication";
import { getScheduledDatesInMonth, getDateStatus } from "@/utils/dates";
import { medications, GENERIC_PHARMACIST_NOTE } from "@/data/medications";
import { PageContainer } from "@/components/PageContainer";
import { SideEffectTrendsChart } from "@/components/SideEffectTrendsChart";
import type { DoseEntry } from "@/types";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

const SIDE_EFFECTS_LIST = [
  { id: "none", label: "Feeling great", emoji: "✅" },
  { id: "nausea", label: "Nausea", emoji: "🤢" },
  { id: "fatigue", label: "Fatigue", emoji: "😴" },
  { id: "headache", label: "Headache", emoji: "🤕" },
  { id: "constipation", label: "Constipation", emoji: "😣" },
  { id: "diarrhea", label: "Diarrhea", emoji: "🏃" },
  { id: "dizziness", label: "Dizziness", emoji: "😵" },
  { id: "site_reaction", label: "Site reaction", emoji: "💉" },
  { id: "low_appetite", label: "Low appetite", emoji: "🍽️" },
];

export default function DoseLog() {
  const { medication } = useMedication();
  const { doses, setDoses } = useDoses();
  const [location, navigate] = useLocation();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showDoseConfirm, setShowDoseConfirm] = useState(false);

  // Close sheets immediately on navigation to prevent fixed backdrop blocking the incoming page
  useEffect(() => {
    setShowAdd(false);
    setShowDoseConfirm(false);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [logTime, setLogTime] = useState(format(new Date(), "HH:mm"));
  const [logSite, setLogSite] = useState(INJECTION_SITES[0]);
  const [logNotes, setLogNotes] = useState("");
  const [logDoseAmount, setLogDoseAmount] = useState<number>(medication?.dose ?? 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logSideEffects, setLogSideEffects] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  if (!medication) return null;

  const medInfo = medications.find((m) => m.id === medication.id);
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const scheduledDates = getScheduledDatesInMonth(medication.startDate, medication.frequency, year, month);

  const firstDay = startOfMonth(viewMonth);
  const lastDay = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const startPadding = getDay(firstDay);

  const handleAddDose = () => {
    if (!selectedDate) return;
    const newDose: DoseEntry = {
      id: Date.now().toString(),
      date: selectedDate,
      time: logTime,
      doseAmount: logDoseAmount,
      site: medInfo?.formulation === "injection" ? logSite : "oral",
      notes: logNotes,
      taken: true,
      sideEffects: logSideEffects.length > 0 ? logSideEffects : undefined,
    };
    if (editingId) {
      setDoses(doses.map((d) => (d.id === editingId ? { ...newDose, id: editingId } : d)));
      setEditingId(null);
      setShowAdd(false);
    } else {
      setDoses([...doses, newDose]);
      setShowDoseConfirm(true);
    }
    setLogNotes("");
  };

  const handleCloseAddForm = () => {
    setShowAdd(false);
    setShowDoseConfirm(false);
  };

  const openAdd = (dateStr?: string) => {
    setSelectedDate(dateStr ?? format(new Date(), "yyyy-MM-dd"));
    setLogTime(format(new Date(), "HH:mm"));
    setLogSite(INJECTION_SITES[0]);
    setLogNotes("");
    setLogDoseAmount(medication.dose);
    setLogSideEffects([]);
    setEditingId(null);
    setShowAdd(true);
  };

  const openEdit = (dose: DoseEntry) => {
    setSelectedDate(dose.date);
    setLogTime(dose.time);
    setLogSite(dose.site);
    setLogNotes(dose.notes);
    setLogDoseAmount(dose.doseAmount);
    setLogSideEffects(dose.sideEffects ?? []);
    setEditingId(dose.id);
    setShowAdd(true);
  };

  const deleteDose = (id: string) => {
    setDoses(doses.filter((d) => d.id !== id));
  };

  const sortedDoses = [...doses].sort((a, b) => b.date.localeCompare(a.date));

  const availableFilters = SIDE_EFFECTS_LIST.filter((effect) =>
    sortedDoses.some((dose) => dose.sideEffects?.includes(effect.id))
  );

  const filteredDoses = activeFilter
    ? sortedDoses.filter((dose) => dose.sideEffects?.includes(activeFilter))
    : sortedDoses;

  return (
    <PageContainer className="pb-4">
      <div className="pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dose Log</h1>
        <div className="flex gap-2 items-center">
          <div className="bg-muted rounded-xl flex p-0.5">
            <button
              data-testid="calendar-view-btn"
              className={`p-1.5 rounded-lg transition-all ${view === "calendar" ? "bg-card shadow-sm" : ""}`}
              onClick={() => { setView("calendar"); setActiveFilter(null); }}
            >
              <CalendarDays size={16} className={view === "calendar" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button
              data-testid="list-view-btn"
              className={`p-1.5 rounded-lg transition-all ${view === "list" ? "bg-card shadow-sm" : ""}`}
              onClick={() => setView("list")}
            >
              <List size={16} className={view === "list" ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <Button
            size="sm"
            className="rounded-xl gap-1"
            onClick={() => openAdd()}
            data-testid="add-dose-btn"
          >
            <Plus size={14} />
            Add
          </Button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="space-y-4">
          <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-4">
              <button
                data-testid="prev-month"
                className="p-2 rounded-xl hover:bg-muted transition-colors"
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
              >
                <ChevronLeft size={18} className="text-muted-foreground" />
              </button>
              <h3 className="font-semibold text-foreground">
                {format(viewMonth, "MMMM yyyy")}
              </h3>
              <button
                data-testid="next-month"
                className="p-2 rounded-xl hover:bg-muted transition-colors"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
              >
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const status = getDateStatus(dateStr, scheduledDates, doses);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === format(new Date(), "yyyy-MM-dd");

                return (
                  <button
                    key={dateStr}
                    data-testid={`day-${dateStr}`}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all relative ${
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : isToday
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-foreground"
                    }`}
                    onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                  >
                    {format(day, "d")}
                    {status !== "none" && (
                      <div
                        className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                          status === "taken"
                            ? "bg-secondary"
                            : status === "missed"
                            ? "bg-destructive"
                            : "bg-amber-400"
                        } ${isSelected ? "opacity-70" : ""}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border justify-center">
              {[
                { color: "bg-secondary", label: "Taken" },
                { color: "bg-amber-400", label: "Scheduled" },
                { color: "bg-destructive", label: "Missed" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${color}`} />
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedDate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground text-sm">
                  {format(parseISO(selectedDate), "EEEE, MMMM d")}
                </h4>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl gap-1 text-xs"
                  onClick={() => openAdd(selectedDate)}
                  data-testid="add-for-date"
                >
                  <Plus size={12} />
                  Log
                </Button>
              </div>
              {doses.filter((d) => d.date === selectedDate).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No doses logged for this date</p>
              ) : (
                doses
                  .filter((d) => d.date === selectedDate)
                  .map((dose) => (
                    <DoseCard key={dose.id} dose={dose} unit={medInfo?.unit ?? "mg"} onEdit={openEdit} onDelete={deleteDose} />
                  ))
              )}
            </motion.div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {availableFilters.length > 0 && (
            <div
              className="flex gap-2 overflow-x-auto pb-1"
              data-testid="side-effect-filter-bar"
              style={{ scrollbarWidth: "none" }}
            >
              {availableFilters.map((effect) => (
                <button
                  key={effect.id}
                  data-testid={`filter-chip-${effect.id}`}
                  className={`flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    activeFilter === effect.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                  onClick={() => setActiveFilter(activeFilter === effect.id ? null : effect.id)}
                >
                  {effect.emoji} {effect.label}
                </button>
              ))}
            </div>
          )}

          <SideEffectTrendsChart doses={sortedDoses} />

          {sortedDoses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
                <CalendarDays size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No doses logged yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start tracking by logging your first dose</p>
            </div>
          ) : filteredDoses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
                <List size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No matching doses</p>
              <p className="text-sm text-muted-foreground mt-1">No doses logged with this side effect</p>
            </div>
          ) : (
            filteredDoses.map((dose) => (
              <DoseCard key={dose.id} dose={dose} unit={medInfo?.unit ?? "mg"} onEdit={openEdit} onDelete={deleteDose} />
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[60] flex items-end"
            onClick={(e) => e.target === e.currentTarget && handleCloseAddForm()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">
                  {showDoseConfirm ? "Dose Logged" : editingId ? "Edit Dose" : "Log Dose"}
                </h3>
                <button
                  className="p-1.5 rounded-xl bg-muted"
                  onClick={handleCloseAddForm}
                  data-testid="close-add-form"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              {showDoseConfirm ? (
                <div className="space-y-4" data-testid="dose-confirm-screen">
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-secondary" />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-foreground">
                        {medication.dose} {medInfo?.unit ?? "mg"} logged
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{medication.brandName}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <FlaskConical size={14} className="text-amber-600 flex-shrink-0" />
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Pharmacist Note</p>
                    </div>
                    <p className="text-sm text-amber-900 leading-relaxed" data-testid="pharmacist-note-text">
                      {medInfo?.pharmacistNote ?? GENERIC_PHARMACIST_NOTE}
                    </p>
                    <button
                      data-testid="view-med-guide-link"
                      className="text-xs font-semibold text-amber-700 underline underline-offset-2 mt-0.5 hover:text-amber-900 transition-colors"
                      onClick={() => { handleCloseAddForm(); navigate("/med-info"); }}
                    >
                      View medication guide →
                    </button>
                  </div>

                  <Button
                    className="w-full h-12 rounded-2xl font-semibold"
                    onClick={handleCloseAddForm}
                    data-testid="done-dose-confirm"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Date</label>
                      <Input
                        type="date"
                        value={selectedDate ?? ""}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rounded-xl"
                        data-testid="dose-date-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Time</label>
                      <Input
                        type="time"
                        value={logTime}
                        onChange={(e) => setLogTime(e.target.value)}
                        className="rounded-xl"
                        data-testid="dose-time-input"
                      />
                    </div>
                  </div>

                  {medInfo && medInfo.doses.length > 1 && (() => {
                    const currentIdx = medInfo.doses.indexOf(medication.dose);
                    const selectedIdx = medInfo.doses.indexOf(logDoseAmount);
                    const isAheadOfSchedule = selectedIdx > currentIdx && currentIdx !== -1;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-muted-foreground">Dose Amount</label>
                          <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Current step: {medication.dose} {medInfo.unit}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2" data-testid="dose-amount-picker">
                          {medInfo.doses.map((d) => {
                            const isCurrent = d === medication.dose;
                            const isSelected = d === logDoseAmount;
                            return (
                              <button
                                key={d}
                                data-testid={`dose-amount-${d}`}
                                className={`relative rounded-2xl py-3 text-sm font-bold border-2 transition-all ${
                                  isSelected
                                    ? "border-secondary bg-secondary/10 text-secondary"
                                    : "border-border bg-background text-foreground"
                                }`}
                                onClick={() => setLogDoseAmount(d)}
                              >
                                {d} {medInfo.unit}
                                {isCurrent && (
                                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                                    My step
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <AnimatePresence>
                          {isAheadOfSchedule && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-start gap-2 rounded-2xl p-3 bg-amber-50 border border-amber-200"
                              data-testid="escalation-skip-warning"
                            >
                              <AlertCircle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                              <p className="text-xs text-amber-800 leading-relaxed">
                                {logDoseAmount} {medInfo.unit} is ahead of your current {medication.dose} {medInfo.unit} step. This may not match your prescriber's escalation plan — check with them before skipping a step.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })()}

                  {medInfo?.formulation === "injection" && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Injection Site</label>
                      <div className="grid grid-cols-2 gap-2">
                        {INJECTION_SITES.map((site) => (
                          <button
                            key={site}
                            data-testid={`site-select-${site.toLowerCase().replace(" ", "-")}`}
                            className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                              logSite === site
                                ? "border-secondary bg-secondary/10 text-secondary"
                                : "border-border bg-background text-foreground"
                            }`}
                            onClick={() => setLogSite(site)}
                          >
                            {site}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Notes</label>
                    <Input
                      placeholder="Side effects, feelings..."
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      className="rounded-xl"
                      data-testid="dose-notes-input"
                    />
                  </div>

                  <Button className="w-full h-12 rounded-2xl font-semibold" onClick={handleAddDose} data-testid="save-dose-btn">
                    {editingId ? "Save Changes" : "Log Dose"}
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageContainer>
  );
}

function DoseCard({
  dose,
  unit,
  onEdit,
  onDelete,
}: {
  dose: DoseEntry;
  unit: string;
  onEdit: (d: DoseEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid={`dose-card-${dose.id}`}
      className="bg-card rounded-2xl p-4 shadow-sm border border-border flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-3 h-3 rounded-full bg-secondary flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {dose.doseAmount} {unit}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {format(parseISO(dose.date), "MMM d")} · {dose.time}
            {dose.site && dose.site !== "oral" ? ` · ${dose.site}` : ""}
          </p>
          {dose.notes && (
            <p className="text-xs text-muted-foreground italic truncate mt-0.5">{dose.notes}</p>
          )}
          {dose.sideEffects && dose.sideEffects.length > 0 && (() => {
            const isNoneOnly = dose.sideEffects!.length === 1 && dose.sideEffects![0] === "none";
            if (isNoneOnly) {
              return (
                <div className="flex items-center gap-1 mt-1.5" data-testid={`side-effects-${dose.id}`}>
                  <span className="text-[10px] text-secondary font-semibold">✅ Feeling great</span>
                </div>
              );
            }
            const effects = dose.sideEffects!
              .filter((id) => id !== "none")
              .map((id) => SIDE_EFFECTS_LIST.find((e) => e.id === id))
              .filter(Boolean);
            if (effects.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 mt-1.5" data-testid={`side-effects-${dose.id}`}>
                {effects.map((e) => (
                  <span
                    key={e!.id}
                    className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5"
                  >
                    {e!.emoji} {e!.label}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          className="p-2 rounded-xl hover:bg-muted transition-colors"
          onClick={() => onEdit(dose)}
          data-testid={`edit-dose-${dose.id}`}
        >
          <List size={14} className="text-muted-foreground" />
        </button>
        <button
          className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"
          onClick={() => onDelete(dose.id)}
          data-testid={`delete-dose-${dose.id}`}
        >
          <Trash2 size={14} className="text-destructive" />
        </button>
      </div>
    </div>
  );
}
