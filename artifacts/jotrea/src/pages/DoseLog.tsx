import { useState } from "react";
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
import { ChevronLeft, ChevronRight, Plus, Trash2, X, List, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMedication, useDoses } from "@/hooks/useMedication";
import { getScheduledDatesInMonth, getDateStatus } from "@/utils/dates";
import { medications } from "@/data/medications";
import type { DoseEntry } from "@/types";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

export default function DoseLog() {
  const { medication } = useMedication();
  const { doses, setDoses } = useDoses();
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [logTime, setLogTime] = useState(format(new Date(), "HH:mm"));
  const [logSite, setLogSite] = useState(INJECTION_SITES[0]);
  const [logNotes, setLogNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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
      doseAmount: medication.dose,
      site: medInfo?.formulation === "injection" ? logSite : "oral",
      notes: logNotes,
      taken: true,
    };
    if (editingId) {
      setDoses(doses.map((d) => (d.id === editingId ? { ...newDose, id: editingId } : d)));
      setEditingId(null);
    } else {
      setDoses([...doses, newDose]);
    }
    setShowAdd(false);
    setLogNotes("");
  };

  const openAdd = (dateStr?: string) => {
    setSelectedDate(dateStr ?? format(new Date(), "yyyy-MM-dd"));
    setLogTime(format(new Date(), "HH:mm"));
    setLogSite(INJECTION_SITES[0]);
    setLogNotes("");
    setEditingId(null);
    setShowAdd(true);
  };

  const openEdit = (dose: DoseEntry) => {
    setSelectedDate(dose.date);
    setLogTime(dose.time);
    setLogSite(dose.site);
    setLogNotes(dose.notes);
    setEditingId(dose.id);
    setShowAdd(true);
  };

  const deleteDose = (id: string) => {
    setDoses(doses.filter((d) => d.id !== id));
  };

  const sortedDoses = [...doses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="pb-4">
      <div className="px-5 pt-14 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Dose Log</h1>
        <div className="flex gap-2 items-center">
          <div className="bg-muted rounded-xl flex p-0.5">
            <button
              data-testid="calendar-view-btn"
              className={`p-1.5 rounded-lg transition-all ${view === "calendar" ? "bg-card shadow-sm" : ""}`}
              onClick={() => setView("calendar")}
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
        <div className="px-5 space-y-4">
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
        <div className="px-5 space-y-3">
          {sortedDoses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-4">
                <CalendarDays size={28} className="text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No doses logged yet</p>
              <p className="text-sm text-muted-foreground mt-1">Start tracking by logging your first dose</p>
            </div>
          ) : (
            sortedDoses.map((dose) => (
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
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-end"
            onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
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
                  {editingId ? "Edit Dose" : "Log Dose"}
                </h3>
                <button
                  className="p-1.5 rounded-xl bg-muted"
                  onClick={() => setShowAdd(false)}
                  data-testid="close-add-form"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
