import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { CompanionMedication } from "@/types";

interface AddCompanionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (med: Omit<CompanionMedication, "id" | "createdAt">) => void;
}

const BRAND = "#D4A574";

export function AddCompanionSheet({ open, onOpenChange, onConfirm }: AddCompanionSheetProps) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<CompanionMedication["timeOfDay"]>("Morning");
  const [purpose, setPurpose] = useState("");

  const resetState = () => {
    setName("");
    setDose("");
    setFrequency("");
    setTimeOfDay("Morning");
    setPurpose("");
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetState();
    onOpenChange(val);
  };

  const isValid = name.trim() && dose.trim() && frequency.trim();

  const handleSubmit = () => {
    if (!isValid) return;
    onConfirm({
      name: name.trim(),
      dose: dose.trim(),
      frequency: frequency.trim(),
      timeOfDay,
      purpose: purpose.trim() || undefined,
    });
    handleOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90dvh] flex flex-col rounded-t-[20px] p-0 border-t border-border focus:outline-none [&>button]:hidden"
      >
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-[100px] h-2 rounded-full bg-muted" />
        </div>

        <SheetHeader className="flex-shrink-0 pb-2 px-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SheetTitle className="text-left text-lg font-bold">
                Add Companion Medication
              </SheetTitle>
              <SheetDescription className="text-left text-xs mt-0.5">
                Reference only. No reminders or tracking will be added.
              </SheetDescription>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all flex-shrink-0"
              aria-label="Close companion medication form"
              data-testid="button-close-companion-form"
            >
              <X size={14} className="text-foreground" />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Medication Name *
            </label>
            <Input
              placeholder="e.g. Metformin, Lisinopril..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl h-12 bg-card shadow-sm border-border/60"
              data-testid="input-companion-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Dose *
              </label>
              <Input
                placeholder="e.g. 500mg"
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                data-testid="input-companion-dose"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Frequency *
              </label>
              <Input
                placeholder="e.g. Daily"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="rounded-xl h-12 bg-card shadow-sm border-border/60"
                data-testid="input-companion-frequency"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Time of Day
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["Morning", "Noon", "Evening", "Night", "As needed"] as const).map((t) => {
                const sel = timeOfDay === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeOfDay(t)}
                    className="py-2.5 rounded-xl text-xs font-semibold border-2 transition-all"
                    style={{
                      backgroundColor: sel ? `${BRAND}12` : "hsl(var(--card))",
                      borderColor: sel ? BRAND : "hsl(var(--border))",
                      color: sel ? BRAND : "hsl(var(--muted-foreground))",
                    }}
                    aria-pressed={sel}
                    data-testid={`button-companion-time-${t.toLowerCase().replace(" ", "-")}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              Purpose (Optional)
            </label>
            <Input
              placeholder="e.g. Blood pressure, Vitamins..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="rounded-xl h-12 bg-card shadow-sm border-border/60"
              data-testid="input-companion-purpose"
            />
          </div>

          <Button
            className="w-full h-12 rounded-2xl text-sm font-bold text-white mt-4"
            style={{ backgroundColor: BRAND }}
            disabled={!isValid}
            onClick={handleSubmit}
            data-testid="button-save-companion"
          >
            Add Medication
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
