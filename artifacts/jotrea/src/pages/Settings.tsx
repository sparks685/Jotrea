import { useState, useEffect } from "react";
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
} from "lucide-react";
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
import { medications } from "@/data/medications";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { getFrequencyLabel, getNextDoseDate } from "@/utils/dates";
import { buildDoseCSV, buildWeightCSV, downloadCSV, scheduleNextDoseNotification } from "@/utils/featureGates";
import { useNotifications } from "@/hooks/useNotifications";
import { trackEvent } from "@/lib/analytics";
import { ChangeMedicationSheet } from "@/components/ChangeMedicationSheet";
import type { MedicationData } from "@/types";

const ADVANCE_OPTIONS = [
  { value: "1", label: "1 hour before" },
  { value: "2", label: "2 hours before" },
  { value: "24", label: "Day before" },
];

export default function Settings() {
  const { user, setUser } = useUser();
  const { medication, setMedication } = useMedication();
  const { doses } = useDoses();
  const { weights } = useWeights();
  const [, setLocation] = useLocation();
  const { permission, requestPermission } = useNotifications();
  const [changeMedOpen, setChangeMedOpen] = useState(false);
  const [changeMedMounted, setChangeMedMounted] = useState(false);

  const notifTime = user.notificationTime ?? "09:00";
  const notifAdvance = user.notificationAdvance ?? "1";
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

  useEffect(() => {
    if (!pushEnabled || !medication || !nextDoseDate) return;
    scheduleNextDoseNotification(
      nextDoseDate,
      medication.brandName,
      medication.dose,
      medInfo?.unit ?? "mg",
      parseInt(notifAdvance, 10)
    );
  }, [pushEnabled, medication, nextDoseDate, notifAdvance, medInfo]);

  const handlePushToggle = async () => {
    if (pushEnabled) {
      setUser({ ...user, notificationsEnabled: false });
      return;
    }
    const result = await requestPermission();
    if (result === "granted") {
      setUser({ ...user, notificationsEnabled: true });
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

  const handleChangeMed = () => {
    setChangeMedMounted(true);
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
    {changeMedMounted && (
      <ChangeMedicationSheet
        open={changeMedOpen}
        onOpenChange={setChangeMedOpen}
        onConfirm={handleMedConfirmed}
      />
    )}
    <div className="px-5 pt-14 pb-4 space-y-5">
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
            value={user.name || ""}
            onChange={(e) => setUser({ ...user, name: e.target.value })}
            placeholder="Your Name"
            className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none text-right max-w-[150px]"
          />
        </SettingsRow>
        <SettingsRow label="Gender">
          <span className="text-sm text-muted-foreground capitalize">{user.gender?.replace(/_/g, " ") || "Not set"}</span>
        </SettingsRow>
        
        <div className="pt-2 pb-1 border-t border-border mt-2">
          <SettingsRow label="Weight Units">
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <button
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  user.units === "lbs" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setUser({ ...user, units: "lbs" })}
                data-testid="setting-units-lbs"
              >
                lbs
              </button>
              <button
                className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
                  user.units === "kg" ? "bg-card shadow text-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setUser({ ...user, units: "kg" })}
                data-testid="setting-units-kg"
              >
                kg
              </button>
            </div>
          </SettingsRow>
        </div>

        <div className="pt-2 pb-1 border-t border-border mt-2 space-y-2">
          <p className="text-sm font-semibold text-foreground">Injection History</p>
          {user.injectionSiteHistory && user.injectionSiteHistory.length > 0 ? (
            <div className="space-y-1">
              {[...user.injectionSiteHistory].reverse().slice(0, 5).map((entry, i) => (
                <p key={i} className="text-xs text-muted-foreground">{entry.site} · {entry.date}</p>
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

      {/* Notifications */}
      <SettingsSection title="Notifications" icon={<Bell size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          <SettingsRow label="Push Notifications">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {permissionIcon}
                <span>{permissionLabel}</span>
              </div>
              <button
                data-testid="push-toggle"
                className="relative w-12 h-6 rounded-full flex-shrink-0 overflow-hidden"
                style={{ backgroundColor: pushEnabled && permission === "granted" ? '#D4A574' : 'var(--color-muted)' }}
                onClick={handlePushToggle}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 700, damping: 30 }}
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
                  style={{ left: pushEnabled && permission === "granted" ? 'calc(100% - 22px)' : '2px' }}
                />
              </button>
            </div>
          </SettingsRow>

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
              <SettingsRow label="Advance Warning">
                <select
                  value={notifAdvance}
                  onChange={(e) => setUser({ ...user, notificationAdvance: e.target.value })}
                  className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none"
                  data-testid="notif-advance"
                >
                  {ADVANCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </SettingsRow>
              {nextDoseDate && (
                <div className="text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2">
                  Next reminder: {nextDoseDate} at {notifTime}
                </div>
              )}
            </>
          )}

          {permission === "denied" && (
            <p className="text-xs text-muted-foreground bg-destructive/10 rounded-xl px-3 py-2">
              Notifications are blocked. Enable them in your browser settings to receive dose reminders.
            </p>
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
            Built by a team of pharmacists and developers dedicated to your GLP-1 journey.
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
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms of Service</span>
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
    </div>
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
