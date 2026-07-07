import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Syringe, Pill, Crown, AlertTriangle, Phone, Thermometer, BookOpen } from "lucide-react";
import { useMedication, useUser } from "@/hooks/useMedication";
import { LockOverlay } from "@/components/LockOverlay";
import { PremiumModal } from "@/components/PremiumModal";
import { medications } from "@/data/medications";

const SIDE_EFFECTS: Record<string, string[]> = {
  default: [
    "Nausea (especially at first)",
    "Vomiting",
    "Diarrhea or constipation",
    "Decreased appetite",
    "Stomach pain or bloating",
    "Fatigue",
  ],
};

const DOSING_TIPS: Record<string, string[]> = {
  weekly: [
    "Take on the same day each week",
    "Rotate injection sites each dose",
    "You can take with or without food",
    "If you miss a dose, take within 5 days",
  ],
  daily: [
    "Take at the same time each day",
    "Consistency is key for effectiveness",
    "If you miss a dose, take as soon as you remember",
    "Do not double dose",
  ],
  "twice-daily": [
    "Take within 60 minutes before morning and evening meals",
    "Space doses at least 6 hours apart",
    "Rotate injection sites",
  ],
};

const WHEN_TO_CALL: string[] = [
  "Severe and persistent nausea or vomiting",
  "Severe abdominal pain that doesn't go away",
  "Signs of pancreatitis: intense stomach pain, nausea, vomiting",
  "Signs of kidney problems: little or no urination, swelling",
  "Severe allergic reaction: rash, itching, difficulty breathing",
  "Vision changes",
];

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  premium: boolean;
  content?: React.ReactNode;
}

export default function MedInfo() {
  const { medication } = useMedication();
  const { user } = useUser();
  const [openSection, setOpenSection] = useState<string | null>("dosing");
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (!medication) return null;

  const medInfo = medications.find((m) => m.id === medication.id);
  const isPremium = user.subscription === "premium";
  const frequency = medication.frequency as keyof typeof DOSING_TIPS;
  const dosingTips = DOSING_TIPS[frequency] ?? DOSING_TIPS.daily;

  const sections: Section[] = [
    {
      id: "dosing",
      title: "Dosing Tips",
      icon: Syringe,
      premium: false,
      content: (
        <ul className="space-y-2">
          {dosingTips.map((tip) => (
            <li key={tip} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
              {tip}
            </li>
          ))}
          {medInfo?.pharmacistNote && (
            <li className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs font-semibold text-amber-800 mb-1">Pharmacist Note</p>
              <p className="text-xs text-amber-700">{medInfo.pharmacistNote}</p>
            </li>
          )}
        </ul>
      ),
    },
    {
      id: "side-effects",
      title: "Common Side Effects",
      icon: AlertTriangle,
      premium: false,
      content: (
        <ul className="space-y-2">
          {SIDE_EFFECTS.default.map((se) => (
            <li key={se} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
              {se}
            </li>
          ))}
          <li className="mt-2 text-xs text-muted-foreground italic">
            Most side effects improve after the first few weeks as your body adjusts.
          </li>
        </ul>
      ),
    },
    {
      id: "call-doctor",
      title: "When to Call Doctor",
      icon: Phone,
      premium: false,
      content: (
        <ul className="space-y-2">
          {WHEN_TO_CALL.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0 mt-1.5" />
              {item}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "storage",
      title: "Storage Instructions",
      icon: Thermometer,
      premium: false,
      content: (
        <div className="space-y-2 text-sm text-foreground">
          <p>Store your medication properly to maintain effectiveness:</p>
          <ul className="space-y-2 mt-2">
            {[
              "Keep refrigerated (36-46°F / 2-8°C) before first use",
              "After first use, can be stored at room temperature (up to 77°F / 25°C)",
              "Do not freeze — discard if frozen",
              "Keep away from heat and light",
              "Check expiration date before each use",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      id: "interactions",
      title: "Drug Interaction Checker",
      icon: BookOpen,
      premium: true,
    },
    {
      id: "symptom-journal",
      title: "Symptom Journal",
      icon: BookOpen,
      premium: true,
    },
  ];

  return (
    <div className="px-5 pt-8 pb-4 space-y-5">
      <PremiumModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <h1 className="text-2xl font-bold text-foreground">Med Info</h1>

      <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">{medication.brandName}</h2>
            <p className="text-sm text-muted-foreground">{medication.genericName}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
              medInfo?.formulation === "injection"
                ? "bg-primary/10 text-primary"
                : "bg-secondary/10 text-secondary"
            }`}
          >
            {medInfo?.formulation === "injection" ? <Syringe size={11} /> : <Pill size={11} />}
            {medInfo?.formulation === "injection" ? "Injection" : "Oral Tablet"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Current Dose</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {medication.dose} {medInfo?.unit}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</p>
            <p className="text-sm font-bold text-foreground mt-0.5 capitalize">
              {medication.frequency.replace("-", " ")}
            </p>
          </div>
        </div>

        {medInfo?.description && (
          <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-border">
            {medInfo.description}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {sections.map((section) => (
          <div
            key={section.id}
            data-testid={`section-${section.id}`}
            className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm relative"
          >
            {section.premium && !isPremium && (
              <LockOverlay
                label={section.title}
                onUpgrade={() => setShowUpgrade(true)}
              />
            )}
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() =>
                section.premium && !isPremium
                  ? setShowUpgrade(true)
                  : setOpenSection(openSection === section.id ? null : section.id)
              }
              data-testid={`toggle-section-${section.id}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    section.premium ? "bg-amber-100" : "bg-muted"
                  }`}
                >
                  {section.premium ? (
                    <Crown size={15} className="text-amber-600 fill-amber-400" />
                  ) : (
                    <section.icon size={15} className="text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm font-semibold text-foreground">{section.title}</span>
              </div>
              {section.premium ? (
                <span className="text-[10px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  Premium
                </span>
              ) : (
                <motion.div
                  animate={{ rotate: openSection === section.id ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={16} className="text-muted-foreground" />
                </motion.div>
              )}
            </button>

            <AnimatePresence>
              {!section.premium && openSection === section.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 pt-0 border-t border-border">{section.content}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
