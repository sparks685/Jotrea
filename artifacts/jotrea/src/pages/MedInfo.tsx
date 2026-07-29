import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Syringe, Pill, AlertTriangle, Phone, Thermometer, BookOpen } from "lucide-react";
import { useMedication } from "@/hooks/useMedication";
import { medications } from "@/data/medications";
import { PageContainer } from "@/components/PageContainer";

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

const DRUG_INTERACTIONS = [
  {
    name: "Insulin & Sulfonylureas",
    detail: "Increased risk of low blood sugar (hypoglycemia). Your doctor may adjust your insulin dose.",
    severity: "high",
  },
  {
    name: "Oral Medications",
    detail: "GLP-1 drugs slow digestion, which can delay absorption of other oral medications. Take time-sensitive pills at consistent times.",
    severity: "moderate",
  },
  {
    name: "Warfarin (blood thinners)",
    detail: "Monitor INR more frequently when starting or changing dose — GLP-1 drugs can affect warfarin levels.",
    severity: "moderate",
  },
  {
    name: "Cyclosporine",
    detail: "Slower gastric emptying may reduce cyclosporine absorption. Take cyclosporine consistently with meals.",
    severity: "moderate",
  },
  {
    name: "Alcohol",
    detail: "Alcohol can worsen GI side effects (nausea, vomiting) and may affect blood sugar levels unpredictably.",
    severity: "low",
  },
];

const severityColor: Record<string, string> = {
  high: "bg-destructive",
  moderate: "bg-amber-400",
  low: "bg-secondary",
};

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export default function MedInfo() {
  const { medication } = useMedication();
  const [openSection, setOpenSection] = useState<string | null>("dosing");

  if (!medication) return null;

  const medInfo = medications.find((m) => m.id === medication.id);
  const frequency = medication.frequency as keyof typeof DOSING_TIPS;
  const dosingTips = DOSING_TIPS[frequency] ?? DOSING_TIPS.daily;

  const sections: Section[] = [
    {
      id: "dosing",
      title: "Dosing Tips",
      icon: Syringe,
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
      id: "interactions",
      title: "Drug Interactions",
      icon: BookOpen,
      content: (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Always tell your doctor and pharmacist about all medications you take. Key interactions to know:
          </p>
          <ul className="space-y-2.5">
            {DRUG_INTERACTIONS.map((item) => (
              <li key={item.name} className="flex items-start gap-2.5">
                <div className={`w-1.5 h-1.5 rounded-full ${severityColor[item.severity]} flex-shrink-0 mt-1.5`} />
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground italic pt-1">
            This is for informational purposes only. Always consult your healthcare provider.
          </p>
        </div>
      ),
    },
    {
      id: "call-doctor",
      title: "When to Call Your Doctor",
      icon: Phone,
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
  ];

  return (
    <PageContainer className="space-y-5">
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
            className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm"
          >
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              data-testid={`toggle-section-${section.id}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center">
                  <section.icon size={15} className="text-muted-foreground" />
                </div>
                <span className="text-sm font-semibold text-foreground">{section.title}</span>
              </div>
              <motion.div
                animate={{ rotate: openSection === section.id ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={16} className="text-muted-foreground" />
              </motion.div>
            </button>

            <AnimatePresence>
              {openSection === section.id && (
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
    </PageContainer>
  );
}
