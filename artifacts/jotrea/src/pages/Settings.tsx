import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Bell,
  Ruler,
  ChevronRight,
  Syringe,
  Crown,
  Info,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser, useMedication } from "@/hooks/useMedication";
import { PremiumBadge } from "@/components/PremiumBadge";
import { PremiumModal } from "@/components/PremiumModal";
import { medications } from "@/data/medications";
import { getFrequencyLabel } from "@/utils/dates";

export default function Settings() {
  const { user, setUser } = useUser();
  const { medication, setMedication } = useMedication();
  const [, setLocation] = useLocation();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [notifTime, setNotifTime] = useState("09:00");
  const [notifAdvance, setNotifAdvance] = useState("1hr");
  const [pushEnabled, setPushEnabled] = useState(false);

  const medInfo = medications.find((m) => m.id === medication?.id);
  const isPremium = user.subscription === "premium";

  const handleChangeMed = () => {
    setMedication(null);
    setLocation("/onboarding");
  };

  const handleDowngrade = () => {
    setUser({ ...user, subscription: "free" });
  };

  return (
    <div className="px-5 pt-8 pb-4 space-y-5">
      <PremiumModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <PremiumBadge variant={isPremium ? "premium" : "free"} />
      </div>

      {!isPremium && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="w-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl p-4 flex items-center justify-between text-white shadow-lg"
          onClick={() => setShowUpgrade(true)}
          data-testid="upgrade-banner"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-1.5">
              <Crown size={18} className="fill-white text-white" />
            </div>
            <div className="text-left">
              <p className="font-bold text-sm">Upgrade to Premium</p>
              <p className="text-amber-100 text-xs">1-month free trial, cancel anytime</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-white/80" />
        </motion.button>
      )}

      <SettingsSection title="Medication">
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
            className="rounded-xl"
            onClick={() => setLocation("/onboarding")}
            data-testid="setup-med-btn"
          >
            Set up Medication
          </Button>
        )}
      </SettingsSection>

      <SettingsSection title="Notifications" icon={<Bell size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          <SettingsRow label="Reminder Time">
            <input
              type="time"
              value={notifTime}
              onChange={(e) => setNotifTime(e.target.value)}
              className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none"
              data-testid="notif-time"
            />
          </SettingsRow>
          <SettingsRow label="Advance Warning">
            <select
              value={notifAdvance}
              onChange={(e) => setNotifAdvance(e.target.value)}
              className="text-sm font-medium text-foreground bg-muted px-2 py-1 rounded-lg border-0 outline-none"
              data-testid="notif-advance"
            >
              <option value="1hr">1 hour before</option>
              <option value="2hr">2 hours before</option>
              <option value="day">Day before</option>
            </select>
          </SettingsRow>
          <SettingsRow label="Push Notifications">
            <button
              data-testid="push-toggle"
              className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${
                pushEnabled ? "bg-primary" : "bg-muted"
              }`}
              onClick={() => setPushEnabled(!pushEnabled)}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  pushEnabled ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title="Units" icon={<Ruler size={14} className="text-muted-foreground" />}>
        <div className="space-y-3">
          <SettingsRow label="Weight">
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
      </SettingsSection>

      <SettingsSection title="Subscription">
        {isPremium ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Crown size={18} className="text-amber-600 fill-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Jotrea Premium</p>
                {user.trialEndDate && (
                  <p className="text-xs text-muted-foreground">
                    Trial ends {user.trialEndDate}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-xl text-muted-foreground"
              onClick={handleDowngrade}
              data-testid="cancel-premium-btn"
            >
              Cancel Premium
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Info size={18} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Free Plan</p>
                <p className="text-xs text-muted-foreground">1 medication, basic tracking</p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
              onClick={() => setShowUpgrade(true)}
              data-testid="upgrade-btn"
            >
              <Crown size={14} />
              Upgrade to Premium
            </Button>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="About" icon={<Info size={14} className="text-muted-foreground" />}>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">App Name</span>
            <span className="text-sm font-semibold text-foreground">Jotrea</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">Version</span>
            <span className="text-sm font-semibold text-foreground">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">Tagline</span>
            <span className="text-sm font-semibold text-foreground text-right max-w-[180px]">
              Your GLP-1 Journey, Simplified
            </span>
          </div>
        </div>
      </SettingsSection>
    </div>
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
    <div className="flex items-center justify-between">
      <span className="text-sm text-foreground">{label}</span>
      {children}
    </div>
  );
}
