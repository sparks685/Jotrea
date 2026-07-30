import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  Syringe,
  Info,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUser, useMedication, useDoses, useWeights } from "@/hooks/useMedication";
// doses is needed for notification scheduling
import { useTheme } from "@/hooks/useTheme";
import { medications } from "@/data/medications";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { getFrequencyLabel, getNextDoseDate } from "@/utils/dates";
import { buildDoseCSV, buildWeightCSV, downloadCSV } from "@/utils/featureGates";
import {
  scheduleAllNotifications,
  cancelAllNotifications,
  rescheduleAllNotifications,
  getNextScheduledTime,
} from "@/utils/notifications";
import { useNotifications } from "@/hooks/useNotifications";
import { trackEvent } from "@/lib/analytics";
import { ChangeMedicationSheet } from "@/components/ChangeMedicationSheet";
import type { MedicationData } from "@/types";

const LBS_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;

const STEPS_BY_ACTIVITY: Record<string, number> = {
  sedentary: 5000,
  lightly_active: 7000,
  active: 9000,
  very_active: 10000,
};

const ADVANCE_OPTIONS = [
  { value: "1", label: "1 hour before" },
  { value: "2", label: "2 hours before" },
  { value: "24", label: "Day before" },
];

const ALL_MOTIVATIONS = [
  { text: "Feel more confident", emoji: "✨" },
  { text: "Fresh start", emoji: "🌱" },
  { text: "Boost my energy", emoji: "⚡" },
  { text: "Improve my health", emoji: "❤️" },
  { text: "Show up for loved ones", emoji: "👨‍👩‍👧" },
  { text: "Special event coming up", emoji: "🎉" },
  { text: "Feel good in my clothes", emoji: "👗" },
  { text: "Other", emoji: "💬" },
];

const ALL_SIDE_EFFECTS = [
  { label: "Nausea", emoji: "🤢" },
  { label: "Fatigue", emoji: "😴" },
  { label: "Hair Loss", emoji: "💇" },
  { label: "Constipation", emoji: "😣" },
  { label: "Bloating", emoji: "😮‍💨" },
  { label: "Sulfur Burps", emoji: "💨" },
  { label: "Heartburn", emoji: "🔥" },
  { label: "Food Noise", emoji: "🍕" },
];

function calcAge(birthday: string): string {
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return String(age);
}

function fmtActivity(level: string): string {
  const map: Record<string, string> = {
    sedentary: "Sedentary", lightly_active: "Lightly Active",
    active: "Active", very_active: "Very Active",
  };
  return map[level] ?? level;
}

function fmtPace(pace: number): string {
  const map: Record<number, string> = { 0.5: "Gentle", 1.0: "Moderate", 1.5: "Steady", 2.0: "Aggressive" };
  return map[pace] ?? `${pace} lbs/wk`;
}

export default function Settings() {
  const { user, setUser } = useUser();
  const { medication, setMedication } = useMedication();
  const { doses } = useDoses();
  const { weights, setWeights } = useWeights();
  const [, setLocation] = useLocation();
  const { permission, requestPermission } = useNotifications();
  const [changeMedOpen, setChangeMedOpen] = useState(false);
  const [editingField, setEditingField] = useState<"motivations" | "side-effects" | "daily-targets" | null>(null);
  const { theme, setTheme } = useTheme();

  const toggleMotivation = useCallback((text: string) => {
    const current = user.motivations ?? [];
    const updated = current.includes(text) ? current.filter((m) => m !== text) : [...current, text];
    setUser({ ...user, motivations: updated });
  }, [user, setUser]);

  const toggleSideEffect = useCallback((label: string) => {
    const current = user.troublesomeSideEffects ?? [];
    const updated = current.includes(label) ? current.filter((s) => s !== label) : [...current, label];
    setUser({ ...user, troublesomeSideEffects: updated });
  }, [user, setUser]);

  const notifTime = user.notificationTime ?? "09:00";
  const pushEnabled = user.notificationsEnabled ?? false;

  const medInfo = medications.find((m) => m.id === medication?.id);

  const nextDoseDateObj = (() => {
    try {
      return medication ? getNextDoseDate(medication.startDate, medication.frequency, doses) : null;
    } catch { return null; }
  })();
  const nextDoseDate = (() => {
    try {
      return nextDoseDateObj && !isNaN(nextDoseDateObj.getTime())
        ? format(nextDoseDateObj, "yyyy-MM-dd") : null;
    } catch { return null; }
  })();

  const nextReminderTime = useMemo(() => {
    if (!medication || !pushEnabled || permission !== "granted") return null;
    try { return getNextScheduledTime(medication, doses, user); } catch { return null; }
  }, [medication, pushEnabled, permission, user.notificationTime]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reschedule whenever reminder time changes or notifications are toggled on
  useEffect(() => {
    if (!pushEnabled || !medication || permission !== "granted") return;
    rescheduleAllNotifications(medication, doses, user);
  }, [user.notificationTime, pushEnabled, permission]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePushToggle = async () => {
    if (pushEnabled) {
      setUser({ ...user, notificationsEnabled: false });
      await cancelAllNotifications();
      return;
    }
    if (permission === "denied") return; // denied-state banner already explains what to do
    const result = await requestPermission();
    if (result === "granted") {
      setUser({ ...user, notificationsEnabled: true });
      if (medication) await scheduleAllNotifications(medication, doses, user);
      trackEvent("notifications_enabled");
    }
  };

  const handleExport = () => {
    const doseCsv = buildDoseCSV(doses);
    const weightCsv = buildWeightCSV(weights, user.units);
    downloadCSV("jotrea-doses.csv", doseCsv);
    setTimeout(() => downloadCSV("jotrea-weights.csv", weightCsv), 300);
    trackEvent("data_exported");
  };

  const handleToggleUnits = (newUnits: "lbs" | "kg") => {
    const currentUnits = user.units;
    if (newUnits === currentUnits) return;
    const toLbs = newUnits === "lbs";
    const factor = toLbs ? LBS_PER_KG : 1 / LBS_PER_KG;

    // Convert all weight entries
    const convertedWeights = weights.map((w) => ({
      ...w,
      weight: parseFloat((w.weight * factor).toFixed(1)),
    }));
    setWeights(convertedWeights);

    // Convert goal weight (source from stored canonical fields)
    let newGoal: number | null = null;
    if (toLbs) {
      const lbsGoal = user.goalWeightLbs ?? (user.goalWeightKg ? parseFloat((user.goalWeightKg * LBS_PER_KG).toFixed(1)) : null);
      newGoal = lbsGoal;
    } else {
      const kgGoal = user.goalWeightKg ?? (user.goalWeightLbs ? parseFloat((user.goalWeightLbs / LBS_PER_KG).toFixed(1)) : null);
      newGoal = kgGoal;
    }

    // Convert stored height
    let newHeight: number | null = null;
    const currentHeightInches = (user.heightFt ?? 0) * 12 + (user.heightIn ?? 0) || user.height || null;
    const currentHeightCm = user.heightCm ?? (currentHeightInches ? parseFloat((currentHeightInches * CM_PER_INCH).toFixed(1)) : null);
    if (toLbs && currentHeightCm) {
      newHeight = parseFloat((currentHeightCm / CM_PER_INCH).toFixed(1));
    } else if (!toLbs && currentHeightInches) {
      newHeight = parseFloat((currentHeightInches * CM_PER_INCH).toFixed(1));
    }

    // Persist conversion into user
    const updatedUser = { ...user, units: newUnits };
    if (newGoal != null) {
      if (toLbs) {
        updatedUser.goalWeightLbs = newGoal;
        updatedUser.goalWeightKg = parseFloat((newGoal / LBS_PER_KG).toFixed(1));
      } else {
        updatedUser.goalWeightKg = newGoal;
        updatedUser.goalWeightLbs = parseFloat((newGoal * LBS_PER_KG).toFixed(1));
      }
      updatedUser.goalWeight = newGoal;
    }
    if (newHeight != null) {
      if (toLbs) {
        updatedUser.height = newHeight;
        updatedUser.heightFt = Math.floor(newHeight / 12);
        updatedUser.heightIn = parseFloat((newHeight % 12).toFixed(1));
      } else {
        updatedUser.heightCm = newHeight;
        updatedUser.height = newHeight;
      }
    }
    setUser(updatedUser);
  };

  const handleChangeMed = () => {
    setChangeMedOpen(true);
  };

  const handleMedConfirmed = (newMed: MedicationData) => {
    setMedication(newMed);
  };

  const permissionIcon =
    permission === "granted" ? (
      <CheckCircle2 size={14} className="text-secondary" />
    ) : permission === "denied" ? (
      <XCircle size={14} className="text-destructive" />
    ) : (
      <AlertCircle size={14} className="text-muted-foreground" />
    );

  const permissionLabel =
    permission === "granted" ? "Allowed" : permission === "denied" ? "Blocked in browser" : "Not set";

  return (
    <>
    <ChangeMedicationSheet
      open={changeMedOpen}
      onOpenChange={setChangeMedOpen}
      onConfirm={handleMedConfirmed}
      injectionSiteHistory={user.injectionSiteHistory}
      currentMedication={medication}
      pastDoseCount={doses.length}
    />
    <PageContainer className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <button
          onClick={handleChangeMed}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
          data-testid="restart-onboarding-btn"
        >
          Restart Setup
        </button>
      </div>

      {/* Profile */}
      <SettingsSection title="Profile" icon={<User size={14} className="text-muted-foreground" />}>
        <SettingsRow label="Name">
          <input
            type="text"
            value={user.name && user.name !== "User" ? user.name : ""}
            onChange={(e) => setUser({ ...user, name: e.target.value })}
            placeholder="Enter your name"
            className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none text-right max-w-[150px]"
          />
        </SettingsRow>
        <SettingsRow label="Gender">
          <span className="text-sm text-muted-foreground capitalize">{user.gender?.replace(/_/g, " ") || "Not set"}</span>
        </SettingsRow>
        {user.birthday && (
          <SettingsRow label="Age">
            <span className="text-sm text-muted-foreground">{calcAge(user.birthday)}</span>
          </SettingsRow>
        )}
        {user.activityLevel && (
          <SettingsRow label="Activity">
            <span className="text-sm text-muted-foreground">{fmtActivity(user.activityLevel)}</span>
          </SettingsRow>
        )}
        {user.goalPaceLbs && (
          <SettingsRow label="Goal Pace">
            <span className="text-sm text-muted-foreground">{fmtPace(user.goalPaceLbs)} · {user.goalPaceLbs} lbs/wk</span>
          </SettingsRow>
        )}
        {/* Motivations */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Motivations</span>
            <button
              className="text-xs font-semibold text-primary px-2 py-0.5 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={() => setEditingField(editingField === "motivations" ? null : "motivations")}
              data-testid="edit-motivations-btn"
            >
              {editingField === "motivations" ? "Done" : "Edit"}
            </button>
          </div>
          {editingField === "motivations" ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_MOTIVATIONS.map((opt) => {
                const selected = (user.motivations ?? []).includes(opt.text);
                return (
                  <button
                    key={opt.text}
                    onClick={() => toggleMotivation(opt.text)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-all ${
                      selected
                        ? "bg-primary/15 border-primary/30 text-primary"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          ) : (user.motivations ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {(user.motivations ?? []).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">None set — tap Edit to add</p>
          )}
        </div>

        {/* Side Effects */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground">Side Effects</span>
            <button
              className="text-xs font-semibold text-primary px-2 py-0.5 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={() => setEditingField(editingField === "side-effects" ? null : "side-effects")}
              data-testid="edit-side-effects-btn"
            >
              {editingField === "side-effects" ? "Done" : "Edit"}
            </button>
          </div>
          {editingField === "side-effects" ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {ALL_SIDE_EFFECTS.map((opt) => {
                const selected = (user.troublesomeSideEffects ?? []).includes(opt.label);
                return (
                  <button
                    key={opt.label}
                    onClick={() => toggleSideEffect(opt.label)}
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-all ${
                      selected
                        ? "bg-amber-100 border-amber-300 text-amber-800"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (user.troublesomeSideEffects ?? []).length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {(user.troublesomeSideEffects ?? []).map((se) => (
                <span
                  key={se}
                  className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                >
                  {se}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">None reported — tap Edit to add</p>
          )}
        </div>

        <div className="pt-2 pb-1 border-t border-border mt-2">
          <SettingsRow label="Weight Units">
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <button
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  user.units === "lbs" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => handleToggleUnits("lbs")}
                data-testid="setting-units-lbs"
              >
                lbs
              </button>
              <button
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  user.units === "kg" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => handleToggleUnits("kg")}
                data-testid="setting-units-kg"
              >
                kg
              </button>
            </div>
          </SettingsRow>
        </div>

        <div className="pt-2 pb-1 border-t border-border mt-2 space-y-2">
          <p className="text-sm font-semibold text-foreground">Injection History</p>
          {doses.length > 0 ? (
            <div className="space-y-1.5">
              {[...doses]
                .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
                .slice(0, 5)
                .map((d) => (
                  <div key={d.id} className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {d.site !== "oral" ? d.site : "Oral"} · {format(parseISO(d.date), "MMM d")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.doseAmount} · {d.time}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No injection history yet.</p>
          )}
        </div>
      </SettingsSection>

      {/* Medication */}
      <SettingsSection title="Medication" icon={<Syringe size={14} className="text-muted-foreground" />}>
        {medication ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Syringe size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{medication.brandName}</p>
                <p className="text-xs text-muted-foreground">
                  {medication.dose} {medInfo?.unit} · {getFrequencyLabel(medication.frequency)}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl gap-2"
              onClick={handleChangeMed}
              data-testid="change-med-btn"
            >
              <RefreshCw size={14} />
              Change Medication
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="rounded-xl gap-2"
            onClick={handleChangeMed}
            data-testid="setup-med-btn"
          >
            <Syringe size={14} />
            Set up Medication
          </Button>
        )}
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance" icon={<Sun size={14} className="text-muted-foreground" />}>
        <SettingsRow label="Theme">
          <div className="flex items-center gap-1 bg-muted rounded-xl p-0.5">
            {(
              [
                { value: "light", icon: <Sun size={13} />, label: "Light" },
                { value: "system", icon: <Monitor size={13} />, label: "Auto" },
                { value: "dark", icon: <Moon size={13} />, label: "Dark" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  theme === opt.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      {/* Daily Targets */}
      <SettingsSection title="Daily Targets" icon={<span className="text-sm">🎯</span>}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Your health goals for each day</p>
            <button
              className="text-xs font-semibold text-primary px-2 py-0.5 rounded-lg hover:bg-primary/10 transition-colors"
              onClick={() => setEditingField(editingField === "daily-targets" ? null : "daily-targets")}
              data-testid="edit-daily-targets-btn"
            >
              {editingField === "daily-targets" ? "Done" : "Edit"}
            </button>
          </div>

          {editingField === "daily-targets" ? (
            <div className="space-y-3 pt-1">
              <SettingsRow label="💧 Water (cups)">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={user.waterGoalCups ?? 8}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setUser({ ...user, waterGoalCups: isNaN(v) || v <= 0 ? undefined : v });
                  }}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
                  }}
                  className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none text-right w-20"
                  data-testid="water-goal-input"
                />
              </SettingsRow>
              <SettingsRow label="🥩 Protein (g)">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={user.proteinGoalG ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setUser({ ...user, proteinGoalG: isNaN(v) || v <= 0 ? undefined : v });
                  }}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
                  }}
                  placeholder={
                    user.currentWeightLbs
                      ? String(Math.round((user.currentWeightLbs / 2.20462) * 0.8))
                      : "Auto"
                  }
                  className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none text-right w-20 placeholder:text-muted-foreground"
                  data-testid="protein-goal-input"
                />
              </SettingsRow>
              <SettingsRow label="👟 Steps / day">
                <input
                  type="number"
                  min={100}
                  max={100000}
                  step={500}
                  value={user.stepsGoal ?? ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setUser({ ...user, stepsGoal: isNaN(v) || v <= 0 ? undefined : v });
                  }}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
                  }}
                  placeholder={
                    user.activityLevel
                      ? String(STEPS_BY_ACTIVITY[user.activityLevel] ?? 7000)
                      : "7000"
                  }
                  className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none text-right w-20 placeholder:text-muted-foreground"
                  data-testid="steps-goal-input"
                />
              </SettingsRow>
              <p className="text-[11px] text-muted-foreground px-0.5">
                Leave blank to use the smart default based on your profile.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">💧 Water</span>
                <span className="text-sm font-medium text-foreground">{user.waterGoalCups ?? 8} cups</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">🥩 Protein</span>
                <span className="text-sm font-medium text-foreground">
                  {user.proteinGoalG
                    ? `${user.proteinGoalG}g`
                    : user.currentWeightLbs
                    ? `${Math.round((user.currentWeightLbs / 2.20462) * 0.8)}g`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">👟 Steps</span>
                <span className="text-sm font-medium text-foreground">
                  {(
                    user.stepsGoal ??
                    (user.activityLevel ? STEPS_BY_ACTIVITY[user.activityLevel] : 7000) ??
                    7000
                  ).toLocaleString()}{" "}
                  / day
                </span>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection title="Notifications" icon={<Bell size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          {/* Denied-state banner */}
          {permission === "denied" && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Notifications disabled</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                Go to iPhone Settings → Notifications → Jotrea, then turn on Allow Notifications.
              </p>
            </div>
          )}

          <SettingsRow label="Dose Reminders">
            <button
              data-testid="push-toggle"
              className="relative w-12 h-6 rounded-full flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: (pushEnabled && permission === "granted") ? '#D4A574' : 'var(--color-muted)' }}
              onClick={handlePushToggle}
            >
              <motion.span
                layout
                transition={{ type: "spring", stiffness: 700, damping: 30 }}
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
                style={{ left: (pushEnabled && permission === "granted") ? 'calc(100% - 22px)' : '2px' }}
              />
            </button>
          </SettingsRow>

          <p className="text-xs text-muted-foreground px-1">
            {permission === "granted" && pushEnabled
              ? "Notifications enabled — dose reminders and weekly weigh-in"
              : permission === "denied"
              ? "Notifications disabled — enable in iOS Settings"
              : "We'll remind you on dose days and weigh-in days"}
          </p>

          {pushEnabled && permission === "granted" && (
            <>
              <SettingsRow label="Reminder Time">
                <input
                  type="time"
                  value={notifTime}
                  onChange={(e) => setUser({ ...user, notificationTime: e.target.value })}
                  className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none"
                  data-testid="notif-time"
                />
              </SettingsRow>

              {nextReminderTime && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
                  <Bell size={11} className="flex-shrink-0" />
                  <span data-testid="next-reminder-display">
                    Next reminder: {format(nextReminderTime, "EEEE, MMM d 'at' h:mm a")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </SettingsSection>

      {/* Data Export */}
      <SettingsSection title="Data" icon={<Download size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Export your full dose and weight history as CSV files for your healthcare provider.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl gap-2"
            onClick={handleExport}
            data-testid="export-data-btn"
          >
            <Download size={14} />
            Export Data (CSV)
          </Button>
        </div>
      </SettingsSection>

      {/* About */}
      <SettingsSection title="About" icon={<Info size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Backed by pharmacy expertise for your GLP-1 journey.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Jotrea is for informational and tracking purposes only. It does not provide medical advice, diagnose conditions, or replace your healthcare provider. Always consult your doctor or pharmacist before making changes to your medication regimen.
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">App Name</span>
              <span className="text-sm font-semibold text-foreground">Jotrea</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-semibold text-foreground">1.0.0</span>
            </div>
          </div>
          <div className="pt-2 border-t border-border flex gap-4 text-xs font-medium text-muted-foreground">
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => window.open("https://jotrea.carrd.co/privacy", "_blank")}
            >Privacy Policy</button>
            <span>·</span>
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => window.open("https://jotrea.carrd.co/terms", "_blank")}
            >Terms of Service</button>
            <span>·</span>
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => window.open("https://jotrea.carrd.co", "_blank")}
            >Support</button>
          </div>
        </div>
      </SettingsSection>

      {/* Account Deletion */}
      <div className="pt-14 pb-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full rounded-2xl h-14 font-semibold shadow-lg">
              Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl max-w-[calc(100%-40px)] w-full mx-auto p-6">
            <AlertDialogHeader className="space-y-3">
              <AlertDialogTitle className="text-xl">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-base text-muted-foreground">
                This will permanently delete all your data. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 flex-col-reverse sm:flex-col-reverse gap-3 sm:gap-0">
              <AlertDialogCancel className="mt-0 w-full h-12 rounded-xl text-base font-semibold border-0 bg-muted hover:bg-muted/80">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                className="w-full h-12 rounded-xl text-base font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg" 
                onClick={() => {
                  localStorage.removeItem("jotrea_medication");
                  localStorage.removeItem("jotrea_doses");
                  localStorage.removeItem("jotrea_weights");
                  localStorage.removeItem("jotrea_user");
                  localStorage.removeItem("jotrea_onboarding");
                  setLocation("/onboarding", { replace: true });
                }}
              >
                Delete Account
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PageContainer>
    </>
  );
}

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
