import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Syringe, Pill, AlertTriangle, BookOpen } from "lucide-react";
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

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
}

export default function MedInfo() {
  const { medication } = useMedication();
  const [openSection, setOpenSection] = useState<string | null>("dosing");
  const [, setLocation] = useLocation();

  if (!medication) return null;

  const medInfo = medications.find((m) => m.id === medication.id);
  const sections: Section[] = [
    {
      id: "dosing",
      title: "Your Tracking Details",
      icon: BookOpen,
      content: (
        <div className="space-y-3 text-sm text-foreground">
          <p>
            This page reflects the medication, dose, and frequency you entered into Jotrea.
          </p>
          <p className="text-xs text-muted-foreground">
            Check these details against your prescription. Jotrea does not verify, calculate,
            recommend, or modify medication dosages or schedules.
          </p>
        </div>
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
            These are examples listed in public prescribing information. Track what you
            experience and discuss symptoms or concerns with your healthcare provider.
          </li>
        </ul>
      ),
    },
    {
      id: "safety",
      title: "Questions & Safety",
      icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-sm text-foreground">
          <p>
            Jotrea does not evaluate symptoms, drug interactions, missed doses, or medication safety.
          </p>
          <p className="text-xs text-muted-foreground">
            Contact your healthcare provider or pharmacist with medication questions. Seek
            immediate professional help for urgent or severe symptoms.
          </p>
        </div>
      ),
    },
    {
      id: "official-info",
      title: "Official Medication Information",
      icon: BookOpen,
      content: (
        <div className="space-y-3 text-sm text-foreground">
          <p>
            Administration, missed-dose, interaction, and storage instructions vary by
            medication and product.
          </p>
          <p className="text-xs text-muted-foreground">
            Use the official prescribing information supplied with your medication and follow
            your healthcare provider's instructions.
          </p>
          <button
            className="text-xs font-semibold text-primary underline underline-offset-2"
            onClick={() => setLocation("/sources")}
          >
            View Sources &amp; References
          </button>
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

      <button
        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-primary underline underline-offset-2"
        onClick={() => setLocation("/sources")}
        data-testid="view-sources-link"
      >
        <BookOpen size={13} />
        View Sources
      </button>
    </PageContainer>
  );
}
