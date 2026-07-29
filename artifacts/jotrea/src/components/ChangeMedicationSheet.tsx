import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Syringe, Pill, Check, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { medications } from "@/data/medications";
import { format } from "date-fns";
import { trackEvent } from "@/lib/analytics";
import type { MedicationData } from "@/types";

const BRAND = "#D4A574";
const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

interface ChangeMedicationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (medication: MedicationData) => void;
}

type View = "select" | "dose";

export function ChangeMedicationSheet({
  open,
  onOpenChange,
  onConfirm,
}: ChangeMedicationSheetProps) {
  const [view, setView] = useState<View>("select");
  const [search, setSearch] = useState("");

  // Standard med selection
  const [selectedMed, setSelectedMed] = useState<(typeof medications)[0] | null>(null);
  const [selectedDose, setSelectedDose] = useState<number | null>(null);

  // Custom med state
  const [isCustomMed, setIsCustomMed] = useState(false);
  const [customBrand, setCustomBrand] = useState("");
  const [customGeneric, setCustomGeneric] = useState("");
  const [customStrength, setCustomStrength] = useState("");
  const [customFormulation, setCustomFormulation] = useState<"injection" | "pill" | "other">("injection");
  const [customDoseAmt, setCustomDoseAmt] = useState("");
  const [customFrequency, setCustomFrequency] = useState("weekly");
  const [customFreqOther, setCustomFreqOther] = useState("");

  // Shared dose-step fields
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [injectionSite, setInjectionSite] = useState(INJECTION_SITES[0]);

  const resetState = () => {
    setView("select");
    setSearch("");
    setSelectedMed(null);
    setSelectedDose(null);
    setIsCustomMed(false);
    setCustomBrand("");
    setCustomGeneric("");
    setCustomStrength("");
    setCustomFormulation("injection");
    setCustomDoseAmt("");
    setCustomFrequency("weekly");
    setCustomFreqOther("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setInjectionSite(INJECTION_SITES[0]);
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  // Med list grouping + filtering
  const grouped = medications.reduce<Record<string, typeof medications>>((acc, med) => {
    if (!acc[med.genericName]) acc[med.genericName] = [];
    acc[med.genericName].push(med);
    return acc;
  }, {});
  const filteredGrouped = Object.entries(grouped).reduce<Record<string, typeof medications>>(
    (acc, [g, meds]) => {
      const f = meds.filter(
        (m) =>
          m.genericName.toLowerCase().includes(search.toLowerCase()) ||
          m.brandNames.some((b) => b.toLowerCase().includes(search.toLowerCase()))
      );
      if (f.length) acc[g] = f;
      return acc;
    },
    {}
  );

  const canConfirmDose = isCustomMed
    ? customBrand.trim() !== "" && customDoseAmt.trim() !== ""
    : selectedDose !== null;

  const handleConfirm = () => {
    let newMed: MedicationData;
    if (isCustomMed) {
      const freq =
        customFrequency === "other" ? customFreqOther || "custom" : customFrequency;
      newMed = {
        id: "custom",
        genericName: customGeneric || customBrand,
        brandName: customBrand,
        dose: parseFloat(customDoseAmt) || 0,
        frequency: freq as MedicationData["frequency"],
        startDate,
        injectionSite: customFormulation === "injection" ? injectionSite : undefined,
        active: true,
      };
      trackEvent("medication_changed", { medication: customBrand || "custom" });
    } else {
      if (!selectedMed || selectedDose === null) return;
      newMed = {
        id: selectedMed.id,
        genericName: selectedMed.genericName,
        brandName: selectedMed.brandNames[0],
        dose: selectedDose,
        frequency: selectedMed.frequency as MedicationData["frequency"],
        startDate,
        injectionSite:
          selectedMed.formulation === "injection" ? injectionSite : undefined,
        active: true,
      };
      trackEvent("medication_changed", { medication: selectedMed.genericName });
    }
    onConfirm(newMed);
    handleOpenChange(false);
  };

  const showInjectionSite =
    (!isCustomMed && selectedMed?.formulation === "injection") ||
    (isCustomMed && customFormulation === "injection");

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[90dvh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 pb-2">
          <div className="flex items-center gap-3">
            {view === "dose" && (
              <button
                onClick={() => setView("select")}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all"
              >
                <ChevronLeft size={16} className="text-foreground" />
              </button>
            )}
            <div>
              <DrawerTitle className="text-left text-lg font-bold">
                {view === "select" ? "Change Medication" : "Set Dose & Details"}
              </DrawerTitle>
              <DrawerDescription className="text-left text-xs mt-0.5">
                {view === "select"
                  ? "Your dose history will be kept."
                  : isCustomMed
                  ? customBrand || "Custom medication"
                  : selectedMed?.brandNames[0]}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <AnimatePresence mode="wait" initial={false}>
          {/* ── View 1: Medication selection ── */}
          {view === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Search bar */}
              <div className="px-4 pb-3 flex-shrink-0">
                {!isCustomMed && (
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="search"
                      placeholder="Search medications…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 rounded-xl h-10 bg-muted border-0 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
                <AnimatePresence mode="wait" initial={false}>
                  {!isCustomMed ? (
                    <motion.div
                      key="list"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="space-y-5"
                    >
                      {Object.entries(filteredGrouped).map(([generic, meds]) => (
                        <div key={generic}>
                          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                            {generic}
                          </p>
                          <div className="space-y-2">
                            {meds.map((med) => {
                              const isPill = med.formulation === "pill";
                              return (
                                <motion.button
                                  key={med.id}
                                  whileTap={{ scale: 0.98 }}
                                  className="w-full text-left rounded-2xl p-4 border-2 transition-all"
                                  style={{
                                    backgroundColor: "hsl(var(--card))",
                                    borderColor: "hsl(var(--border))",
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                                  }}
                                  onClick={() => {
                                    setSelectedMed(med);
                                    setIsCustomMed(false);
                                    setSelectedDose(null);
                                    setView("dose");
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-bold text-foreground truncate text-sm">
                                        {med.brandNames.join(", ")}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {generic}
                                      </p>
                                    </div>
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
                                      style={{
                                        background: isPill
                                          ? "#3b82f618"
                                          : `${BRAND}18`,
                                        color: isPill ? "#3b82f6" : BRAND,
                                      }}
                                    >
                                      {isPill ? (
                                        <Pill size={10} />
                                      ) : (
                                        <Syringe size={10} />
                                      )}
                                      {isPill ? "PILL" : "SHOT"}
                                    </span>
                                  </div>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Other / custom option */}
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
                          Not listed?
                        </p>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          className="w-full text-left rounded-2xl p-4 border-2 transition-all"
                          style={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                          }}
                          onClick={() => {
                            setIsCustomMed(true);
                            setSelectedMed(null);
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-bold text-foreground text-sm">
                                Other medication
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Enter your own brand &amp; dose
                              </p>
                            </div>
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
                              style={{
                                background: "hsl(var(--muted))",
                                color: "hsl(var(--muted-foreground))",
                              }}
                            >
                              CUSTOM
                            </span>
                          </div>
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    /* ── Custom medication form (view=select, isCustomMed=true) ── */
                    <motion.div
                      key="custom-form"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <button
                        onClick={() => setIsCustomMed(false)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronLeft size={13} /> Back to list
                      </button>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Brand Name *
                        </label>
                        <Input
                          placeholder="e.g. Ozempic, Wegovy, Mounjaro…"
                          value={customBrand}
                          onChange={(e) => setCustomBrand(e.target.value)}
                          className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Generic / Active Ingredient
                        </label>
                        <Input
                          placeholder="e.g. Semaglutide, Tirzepatide…"
                          value={customGeneric}
                          onChange={(e) => setCustomGeneric(e.target.value)}
                          className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Strength
                        </label>
                        <Input
                          placeholder="e.g. 2.5 mg, 10 mcg…"
                          value={customStrength}
                          onChange={(e) => setCustomStrength(e.target.value)}
                          className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          Formulation
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            [
                              ["injection", "💉", "Injection"],
                              ["pill", "💊", "Pill"],
                              ["other", "🔬", "Other"],
                            ] as const
                          ).map(([val, emoji, label]) => {
                            const sel = customFormulation === val;
                            return (
                              <motion.button
                                key={val}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setCustomFormulation(val)}
                                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all"
                                style={{
                                  backgroundColor: sel
                                    ? `${BRAND}12`
                                    : "hsl(var(--card))",
                                  borderColor: sel
                                    ? BRAND
                                    : "hsl(var(--border))",
                                }}
                              >
                                <span className="text-xl">{emoji}</span>
                                <span
                                  className={`text-xs font-bold ${sel ? "text-foreground" : "text-muted-foreground"}`}
                                >
                                  {label}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      <Button
                        className="w-full h-12 rounded-2xl text-sm font-bold text-white disabled:opacity-40"
                        style={{ backgroundColor: BRAND }}
                        disabled={!customBrand.trim()}
                        onClick={() => setView("dose")}
                      >
                        Continue →
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* ── View 2: Dose & details ── */}
          {view === "dose" && (
            <motion.div
              key="dose"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">

                {/* Standard med: dose buttons */}
                {!isCustomMed && selectedMed && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Dose
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedMed.doses.map((d) => (
                        <motion.button
                          key={d}
                          whileTap={{ scale: 0.95 }}
                          className="rounded-2xl py-3.5 text-sm font-bold border-2 transition-all"
                          style={{
                            backgroundColor:
                              selectedDose === d ? BRAND : "hsl(var(--card))",
                            borderColor:
                              selectedDose === d ? BRAND : "hsl(var(--border))",
                            color:
                              selectedDose === d
                                ? "white"
                                : "hsl(var(--foreground))",
                            boxShadow:
                              selectedDose === d
                                ? `0 4px 16px ${BRAND}40`
                                : "0 1px 3px rgba(0,0,0,0.04)",
                          }}
                          onClick={() => setSelectedDose(d)}
                        >
                          {d} {selectedMed.unit}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom med: free-entry dose + frequency */}
                {isCustomMed && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Dose Amount *
                      </label>
                      <div className="flex gap-3">
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="e.g. 2.5"
                          value={customDoseAmt}
                          onChange={(e) => setCustomDoseAmt(e.target.value)}
                          className="flex-1 rounded-xl h-12 bg-card shadow-sm border-border/60"
                        />
                        <div className="flex items-center justify-center px-4 rounded-xl border border-border/60 bg-card shadow-sm text-sm font-bold text-muted-foreground">
                          {customStrength
                            ? customStrength.replace(/[\d.]/g, "").trim() || "mg"
                            : "mg"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Dosing Frequency
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { val: "weekly", label: "Weekly" },
                          { val: "daily", label: "Daily" },
                          { val: "twice-daily", label: "Twice Daily" },
                          { val: "monthly", label: "Monthly" },
                          { val: "other", label: "Other…" },
                        ].map((opt) => {
                          const sel = customFrequency === opt.val;
                          return (
                            <motion.button
                              key={opt.val}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => setCustomFrequency(opt.val)}
                              className="py-3 rounded-2xl text-sm font-bold border-2 transition-all"
                              style={{
                                backgroundColor: sel
                                  ? `${BRAND}12`
                                  : "hsl(var(--card))",
                                borderColor: sel ? BRAND : "hsl(var(--border))",
                                color: sel
                                  ? BRAND
                                  : "hsl(var(--muted-foreground))",
                              }}
                            >
                              {opt.label}
                            </motion.button>
                          );
                        })}
                      </div>
                      <AnimatePresence>
                        {customFrequency === "other" && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <Input
                              placeholder="e.g. Every 10 days, twice weekly…"
                              value={customFreqOther}
                              onChange={(e) => setCustomFreqOther(e.target.value)}
                              className="rounded-xl h-12 bg-card shadow-sm border-border/60 mt-2"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {/* Start date — shared */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                  />
                </div>

                {/* Injection site */}
                {showInjectionSite && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                      Injection Site
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {INJECTION_SITES.map((site) => {
                        const sel = injectionSite === site;
                        return (
                          <motion.button
                            key={site}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setInjectionSite(site)}
                            className="flex items-center gap-2 py-3 px-4 rounded-2xl text-sm font-semibold border-2 transition-all"
                            style={{
                              backgroundColor: sel
                                ? `${BRAND}12`
                                : "hsl(var(--card))",
                              borderColor: sel ? BRAND : "hsl(var(--border))",
                              color: sel ? BRAND : "hsl(var(--muted-foreground))",
                            }}
                          >
                            {sel && (
                              <div
                                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: BRAND }}
                              >
                                <Check size={9} className="text-white" strokeWidth={3} />
                              </div>
                            )}
                            {site}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm button */}
              <div className="px-4 pb-6 pt-2 flex-shrink-0">
                <Button
                  className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-lg disabled:opacity-40"
                  style={{ backgroundColor: BRAND }}
                  disabled={!canConfirmDose}
                  onClick={handleConfirm}
                  data-testid="confirm-med-change-btn"
                >
                  Confirm Medication Change
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
}
