import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Search, Syringe, Pill, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { medications } from "@/data/medications";
import { useMedication, useDoses, useWeights, useUser } from "@/hooks/useMedication";
import { format, subDays, subWeeks } from "date-fns";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

function seedDemoData(
  medId: string,
  frequency: string,
  dose: number,
  setDoses: (v: any) => void,
  setWeights: (v: any) => void
) {
  const today = new Date();
  const demoWeights = Array.from({ length: 5 }, (_, i) => ({
    id: `w${i}`,
    date: format(subDays(today, (4 - i) * 7), "yyyy-MM-dd"),
    weight: 215 - i * 2.3,
  }));

  const demoDoses = [];
  if (frequency === "weekly") {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({
        id: `d${i}`,
        date: format(subWeeks(today, i), "yyyy-MM-dd"),
        time: "09:00",
        doseAmount: dose,
        site: INJECTION_SITES[i % 4],
        notes: "",
        taken: true,
      });
    }
  } else {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({
        id: `d${i}`,
        date: format(subDays(today, i), "yyyy-MM-dd"),
        time: "08:00",
        doseAmount: dose,
        site: INJECTION_SITES[0],
        notes: "",
        taken: true,
      });
    }
  }

  setDoses(demoDoses);
  setWeights(demoWeights);
}

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedMed, setSelectedMed] = useState<(typeof medications)[0] | null>(null);
  const [selectedDose, setSelectedDose] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [injectionSite, setInjectionSite] = useState(INJECTION_SITES[0]);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const { setMedication } = useMedication();
  const { setDoses } = useDoses();
  const { setWeights } = useWeights();
  const { setUser } = useUser();

  const grouped = medications.reduce<Record<string, typeof medications>>((acc, med) => {
    if (!acc[med.genericName]) acc[med.genericName] = [];
    acc[med.genericName].push(med);
    return acc;
  }, {});

  const filteredGrouped = Object.entries(grouped).reduce<Record<string, typeof medications>>(
    (acc, [generic, meds]) => {
      const filtered = meds.filter(
        (m) =>
          m.genericName.toLowerCase().includes(search.toLowerCase()) ||
          m.brandNames.some((b) => b.toLowerCase().includes(search.toLowerCase()))
      );
      if (filtered.length) acc[generic] = filtered;
      return acc;
    },
    {}
  );

  const handleComplete = () => {
    if (!selectedMed || !selectedDose) return;
    const medData = {
      id: selectedMed.id,
      genericName: selectedMed.genericName,
      brandName: selectedMed.brandNames[0],
      dose: selectedDose,
      frequency: selectedMed.frequency as "weekly" | "daily" | "twice-daily",
      startDate,
      injectionSite: selectedMed.formulation === "injection" ? injectionSite : undefined,
      active: true,
    };
    setMedication(medData);
    setUser({ name: "", units: "lbs", subscription: "free" });
    seedDemoData(selectedMed.id, selectedMed.frequency, selectedDose, setDoses, setWeights);
    setLocation("/");
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-8"
          >
            <div className="space-y-2">
              <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Syringe size={36} className="text-primary" />
              </div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Jotrea</h1>
              <p className="text-base text-muted-foreground font-medium">
                Your GLP-1 Journey, Simplified
              </p>
            </div>

            <div className="space-y-3 w-full max-w-xs">
              {[
                "Track doses effortlessly",
                "Monitor your weight progress",
                "Stay on schedule",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-left">
                  <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                    <Check size={11} className="text-secondary" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="w-full max-w-xs space-y-3">
              <div className="flex gap-1.5 justify-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
                onClick={() => setStep(1)}
                data-testid="start-journey-btn"
              >
                Start Your Journey
                <ChevronRight size={18} className="ml-1" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="select-med"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex-1 flex flex-col"
          >
            <div className="px-6 pt-12 pb-4 space-y-1">
              <div className="flex gap-1.5 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i <= step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
              <h2 className="text-2xl font-bold text-foreground">Select Medication</h2>
              <p className="text-sm text-muted-foreground">Choose your GLP-1 medication</p>
            </div>

            <div className="px-6 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search medications..."
                  className="pl-9 rounded-xl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  data-testid="med-search"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {Object.entries(filteredGrouped).map(([generic, meds]) => (
                <div key={generic}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {generic}
                  </p>
                  <div className="space-y-2">
                    {meds.map((med) => {
                      const isSelected = selectedMed?.id === med.id;
                      return (
                        <button
                          key={med.id}
                          data-testid={`med-${med.id}`}
                          className={`w-full text-left rounded-2xl p-4 border-2 transition-all duration-200 ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                          onClick={() => {
                            setSelectedMed(med);
                            setStep(2);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground text-sm">
                                {med.brandNames.join(", ")}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{generic}</p>
                            </div>
                            <div className="flex gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                  med.formulation === "injection"
                                    ? "bg-primary/10 text-primary"
                                    : "bg-secondary/10 text-secondary"
                                }`}
                              >
                                {med.formulation === "injection" ? (
                                  <Syringe size={10} />
                                ) : (
                                  <Pill size={10} />
                                )}
                                {med.formulation}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 2 && selectedMed && (
          <motion.div
            key="set-dose"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            className="flex-1 flex flex-col"
          >
            <div className="px-6 pt-12 pb-4 space-y-1">
              <div className="flex gap-1.5 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i <= step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
              <button
                className="text-xs text-primary font-medium mb-1"
                onClick={() => setStep(1)}
              >
                ← Back
              </button>
              <h2 className="text-2xl font-bold text-foreground">Set Your Dose</h2>
              <p className="text-sm text-muted-foreground">{selectedMed.brandNames[0]}</p>
            </div>

            <div className="flex-1 px-6 pb-8 space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Starting Dose</label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedMed.doses.map((d) => (
                    <button
                      key={d}
                      data-testid={`dose-${d}`}
                      className={`rounded-xl py-3 text-sm font-semibold border-2 transition-all ${
                        selectedDose === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40"
                      }`}
                      onClick={() => setSelectedDose(d)}
                    >
                      {d} {selectedMed.unit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl"
                  data-testid="start-date-input"
                />
              </div>

              {selectedMed.formulation === "injection" && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">First Injection Site</label>
                  <div className="grid grid-cols-2 gap-2">
                    {INJECTION_SITES.map((site) => (
                      <button
                        key={site}
                        data-testid={`site-${site.toLowerCase().replace(" ", "-")}`}
                        className={`rounded-xl py-2.5 text-sm font-medium border-2 transition-all ${
                          injectionSite === site
                            ? "border-secondary bg-secondary/10 text-secondary"
                            : "border-border bg-card text-foreground hover:border-secondary/40"
                        }`}
                        onClick={() => setInjectionSite(site)}
                      >
                        {site}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border">
                <div>
                  <p className="text-sm font-semibold text-foreground">Injection Reminders</p>
                  <p className="text-xs text-muted-foreground">Get notified on dose days</p>
                </div>
                <button
                  data-testid="reminder-toggle"
                  className={`w-12 h-6 rounded-full transition-colors duration-200 relative ${
                    reminderEnabled ? "bg-primary" : "bg-muted"
                  }`}
                  onClick={() => setReminderEnabled(!reminderEnabled)}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                      reminderEnabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <span className="text-amber-600 text-xs font-bold">1</span>
                  </div>
                  <p className="text-sm font-semibold text-amber-800">
                    Start your 1-month free trial of Jotrea Premium
                  </p>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Unlock multiple medications, side effect journal, PDF export, and more.
                  No charge for 30 days.
                </p>
              </div>

              <Button
                className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg"
                disabled={!selectedDose}
                onClick={handleComplete}
                data-testid="complete-onboarding"
              >
                Begin My Journey
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
