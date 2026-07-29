import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Syringe, Flame, Calendar, Plus, X, Scale, BookOpen, FlaskConical, CheckCircle2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownRing } from "@/components/CountdownRing";
import { useMedication, useDoses, useWeights, useUser } from "@/hooks/useMedication";
import {
  getNextDoseDate,
  getDaysUntilDose,
  getFrequencyLabel,
  getNextThreeDoses,
} from "@/utils/dates";
import {
  calculateStreak,
  getLastDose,
  getLast7WeightEntries,
} from "@/utils/calculations";
import { trackEvent } from "@/lib/analytics";
import { medications } from "@/data/medications";
import type { DoseEntry, WeightEntry } from "@/types";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

export default function Dashboard() {
  const { medication } = useMedication();
  const { doses, setDoses } = useDoses();
  const { weights, setWeights } = useWeights();
  const { user, setUser } = useUser();
  const [, navigate] = useLocation();

  const [showLogForm, setShowLogForm] = useState(false);
  const [showDoseConfirm, setShowDoseConfirm] = useState(false);
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logTime, setLogTime] = useState(format(new Date(), "HH:mm"));
  const [logSite, setLogSite] = useState(INJECTION_SITES[0]);
  const [logNotes, setLogNotes] = useState("");

  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightValue, setWeightValue] = useState("");
  const [weightDate, setWeightDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [weightNotes, setWeightNotes] = useState("");

  if (!medication) return null;

  const medInfo = medications.find((m) => m.id === medication.id);
  const nextDoseDate = getNextDoseDate(medication.startDate, medication.frequency, doses);
  const daysUntil = getDaysUntilDose(nextDoseDate);
  const isDueToday = daysUntil === 0;
  const streak = calculateStreak(doses, medication.startDate, medication.frequency);
  const lastDose = getLastDose(doses);
  const weightEntries = getLast7WeightEntries(weights);
  const nextThree = getNextThreeDoses(medication.startDate, medication.frequency, doses);
  const latestWeight = [...weights].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  const prevWeight = [...weights].sort((a, b) => b.date.localeCompare(a.date))[1] ?? null;
  const weightDelta =
    latestWeight && prevWeight ? latestWeight.weight - prevWeight.weight : null;

  const intervalDays =
    medication.frequency === "weekly" ? 7 : medication.frequency === "twice-daily" ? 0.5 : 1;

  const chartData = weightEntries.map((w) => ({
    date: format(parseISO(w.date), "MMM d"),
    weight: w.weight,
  }));

  const PHARMACY_TIPS = [
    "Take semaglutide on the same day each week for best results.",
    "Inject into a new area within the same site to avoid lipodystrophy.",
    "Stay hydrated — at least 8 glasses of water daily reduces nausea.",
    "Eating slowly and stopping at 80% full helps maximize GLP-1 effects.",
    "Protein at every meal preserves muscle while losing fat on GLP-1s.",
    "If you forget a dose, take it within 5 days (weekly) or skip if too late.",
    "Nausea usually improves after 4–8 weeks as your body adjusts.",
    "Tirzepatide works on both GLP-1 and GIP receptors for enhanced effect.",
    "Rotating injection sites reduces scar tissue buildup over time.",
    "Log your dose within 2 hours for the most accurate streak tracking.",
    "Sulfur burps? Avoid high-fat foods and eat smaller, more frequent meals.",
    "Constipation on GLP-1? Try fiber-rich foods and magnesium citrate.",
    "Hair loss on GLP-1s is usually temporary — ensure adequate protein intake.",
    "Always store pen injectors in the refrigerator until opened.",
  ];
  
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const tip = PHARMACY_TIPS[dayOfYear % PHARMACY_TIPS.length];

  const GENERIC_PHARMACIST_NOTE =
    "Take your medication exactly as prescribed. Always rotate injection sites, store as directed on the label, and never double dose if you miss one. When in doubt, ask your pharmacist.";

  const handleLogDose = () => {
    const finalSite = medication.id.includes("rybelsus") ? "oral" : logSite;
    const newDose: DoseEntry = {
      id: Date.now().toString(),
      date: logDate,
      time: logTime,
      doseAmount: medication.dose,
      site: finalSite,
      notes: logNotes,
      taken: true,
    };
    setDoses([...doses, newDose]);

    if (finalSite !== "oral") {
      const newHistoryEntry = { site: finalSite, date: format(parseISO(logDate), "MMM d") };
      setUser({
        ...user,
        injectionSiteHistory: [...(user.injectionSiteHistory || []), newHistoryEntry]
      });
    }

    trackEvent("dose_logged");
    setLogNotes("");
    setShowDoseConfirm(true);
  };

  const handleCloseLogForm = () => {
    setShowLogForm(false);
    setShowDoseConfirm(false);
  };

  const handleAddWeight = () => {
    const w = parseFloat(weightValue);
    if (!w || isNaN(w)) return;
    const entry: WeightEntry = {
      id: Date.now().toString(),
      date: weightDate,
      weight: w,
      notes: weightNotes || undefined,
    };
    setWeights([...weights, entry]);
    trackEvent("weight_logged");
    setShowWeightForm(false);
    setWeightValue("");
    setWeightNotes("");
  };

  return (
    <div className="px-5 pt-14 pb-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Good {getGreeting()}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {medication.brandName} · {medication.dose} {medInfo?.unit}
          </p>
        </div>
        <div className="bg-primary/10 rounded-2xl px-3 py-1.5">
          <p className="text-xs font-semibold text-primary">{getFrequencyLabel(medication.frequency)}</p>
        </div>
      </div>

      {/* Countdown ring + primary CTA */}
      <div className="bg-card rounded-3xl p-5 shadow-md border border-border flex flex-col items-center gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {isDueToday ? "Your dose is due today" : "Next dose in"}
        </p>
        <CountdownRing daysUntil={daysUntil} intervalDays={intervalDays} size={160} />

        <motion.div
          animate={isDueToday ? { scale: [1, 1.04, 1] } : {}}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="w-full"
        >
          <Button
            className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
            onClick={() => setShowLogForm(true)}
            data-testid="log-dose-btn"
          >
            <Syringe size={18} className="mr-2" />
            Log Dose
          </Button>
        </motion.div>
      </div>

      {/* Quick action row */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowWeightForm(true)}
          data-testid="add-weight-quick-btn"
          className="flex items-center gap-2.5 bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-muted/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center">
            <Scale size={16} className="text-secondary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Add Weight</p>
            {latestWeight ? (
              <p className="text-[11px] text-muted-foreground">
                {latestWeight.weight} {user.units}
                {weightDelta !== null && (
                  <span className={weightDelta < 0 ? "text-secondary ml-1" : "text-destructive ml-1"}>
                    {weightDelta > 0 ? "+" : ""}{weightDelta.toFixed(1)}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">No entries yet</p>
            )}
          </div>
        </button>

        <button
          onClick={() => navigate("/med-info")}
          data-testid="med-info-quick-btn"
          className="flex items-center gap-2.5 bg-card border border-border rounded-2xl px-4 py-3.5 shadow-sm hover:bg-muted/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen size={16} className="text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-foreground">Med Info</p>
            <p className="text-[11px] text-muted-foreground">{medication.brandName}</p>
          </div>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Last Dose"
          value={lastDose ? format(parseISO(lastDose.date), "MMM d") : "—"}
          sub={lastDose ? lastDose.site : "No doses yet"}
        />
        <StatCard
          label="Current Dose"
          value={`${medication.dose}`}
          sub={medInfo?.unit ?? "mg"}
        />
        <StatCard
          label="Streak"
          value={streak.toString()}
          sub="in a row"
          icon={<Flame size={14} className="text-amber-500" />}
        />
      </div>

      {/* Pharmacy Tip */}
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
            <FlaskConical size={16} className="text-amber-600" />
          </div>
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Tip from Our Pharmacy Team</p>
        </div>
        <p className="text-sm text-amber-900 leading-relaxed">{tip}</p>
      </div>

      {/* Mini weight chart */}
      <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Weight Trend</p>
          {chartData.length > 0 && (
            <p className="text-xs text-muted-foreground">Last 7 entries</p>
          )}
        </div>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${val} ${user.units}`, "Weight"]}
              />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--secondary))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "hsl(var(--secondary))", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "hsl(var(--secondary))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center py-5 gap-2">
            <Scale size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground text-center">
              Start logging weight to see your trend
            </p>
            <button
              onClick={() => setShowWeightForm(true)}
              className="mt-1 text-xs font-semibold px-4 py-1.5 rounded-full border border-border hover:bg-muted/40 transition-colors"
            >
              Add first entry
            </button>
          </div>
        )}
      </div>

      {/* Upcoming doses */}
      {nextThree.length > 0 && (
        <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-3">
          <p className="text-sm font-semibold text-foreground">Upcoming Doses</p>
          <div className="space-y-2">
            {nextThree.map((dateStr, i) => (
              <div
                key={dateStr}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                      i === 0 ? "bg-primary/10" : "bg-muted"
                    }`}
                  >
                    <Calendar size={14} className={i === 0 ? "text-primary" : "text-muted-foreground"} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(parseISO(dateStr), "EEEE, MMM d")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {medication.dose} {medInfo?.unit} · {medication.brandName}
                    </p>
                  </div>
                </div>
                {i === 0 && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    Next
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log Dose bottom sheet */}
      <AnimatePresence>
        {showLogForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-end"
            onClick={(e) => e.target === e.currentTarget && handleCloseLogForm()}
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
                  {showDoseConfirm ? "Dose Logged" : "Log Dose"}
                </h3>
                <button
                  className="p-1.5 rounded-xl bg-muted"
                  onClick={handleCloseLogForm}
                  data-testid="close-log-form"
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
                  </div>

                  <Button
                    className="w-full h-12 rounded-2xl font-semibold"
                    onClick={handleCloseLogForm}
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
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="rounded-xl"
                        data-testid="log-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Time</label>
                      <Input
                        type="time"
                        value={logTime}
                        onChange={(e) => setLogTime(e.target.value)}
                        className="rounded-xl"
                        data-testid="log-time"
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
                            data-testid={`log-site-${site.toLowerCase().replace(" ", "-")}`}
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
                    <label className="text-xs font-semibold text-muted-foreground">Notes (optional)</label>
                    <Input
                      placeholder="How are you feeling?"
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      className="rounded-xl"
                      data-testid="log-notes"
                    />
                  </div>

                  <Button
                    className="w-full h-12 rounded-2xl font-semibold"
                    onClick={handleLogDose}
                    data-testid="submit-log-dose"
                  >
                    <Plus size={16} className="mr-2" />
                    Log This Dose
                  </Button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Weight bottom sheet */}
      <AnimatePresence>
        {showWeightForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-end"
            onClick={(e) => e.target === e.currentTarget && setShowWeightForm(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="w-full max-w-md mx-auto bg-card rounded-t-3xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-foreground">Add Weight</h3>
                <button
                  className="p-1.5 rounded-xl bg-muted"
                  onClick={() => setShowWeightForm(false)}
                  data-testid="close-weight-form"
                >
                  <X size={16} className="text-muted-foreground" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Weight ({user.units})
                  </label>
                  <Input
                    type="number"
                    placeholder={user.units === "lbs" ? "e.g. 195" : "e.g. 88"}
                    value={weightValue}
                    onChange={(e) => setWeightValue(e.target.value)}
                    className="rounded-xl"
                    data-testid="quick-weight-value"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={weightDate}
                    onChange={(e) => setWeightDate(e.target.value)}
                    className="rounded-xl"
                    data-testid="quick-weight-date"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Notes (optional)</label>
                <Input
                  placeholder="Morning weight, post-workout..."
                  value={weightNotes}
                  onChange={(e) => setWeightNotes(e.target.value)}
                  className="rounded-xl"
                  data-testid="quick-weight-notes"
                />
              </div>

              <Button
                className="w-full h-12 rounded-2xl font-semibold"
                onClick={handleAddWeight}
                data-testid="submit-weight-btn"
              >
                <Scale size={16} className="mr-2" />
                Save Entry
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl p-3.5 shadow-sm border border-border text-center space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
