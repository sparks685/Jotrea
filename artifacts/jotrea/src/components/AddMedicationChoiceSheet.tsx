import { X, Syringe, Pill } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { motion } from "framer-motion";

interface AddMedicationChoiceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTracker: () => void;
  onSelectCompanion: () => void;
}

const BRAND = "#D4A574";

export function AddMedicationChoiceSheet({
  open,
  onOpenChange,
  onSelectTracker,
  onSelectCompanion,
}: AddMedicationChoiceSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[20px] p-0 border-t border-border focus:outline-none [&>button]:hidden"
      >
        <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
          <div className="w-[100px] h-2 rounded-full bg-muted" />
        </div>

        <SheetHeader className="flex-shrink-0 pb-2 px-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SheetTitle className="text-left text-lg font-bold">
                Add to Cabinet
              </SheetTitle>
              <SheetDescription className="text-left text-xs mt-0.5">
                What kind of medication are you adding?
              </SheetDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-all flex-shrink-0"
              aria-label="Close add medication options"
              data-testid="button-close-medication-options"
            >
              <X size={14} className="text-foreground" />
            </button>
          </div>
        </SheetHeader>

        <div className="px-4 pb-8 space-y-4 mt-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onOpenChange(false);
              onSelectTracker();
            }}
            className="w-full text-left rounded-2xl p-5 border-2 transition-all flex items-start gap-4"
            style={{
              backgroundColor: "hsl(var(--card))",
              borderColor: BRAND,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
            data-testid="button-choice-tracker"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${BRAND}18`, color: BRAND }}
            >
              <Syringe size={20} />
            </div>
            <div>
              <p className="font-bold text-foreground">GLP-1 Tracker</p>
              <p className="text-xs text-muted-foreground mt-1">
                Log doses, track weight context, and receive reminder notifications.
              </p>
            </div>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              onOpenChange(false);
              onSelectCompanion();
            }}
            className="w-full text-left rounded-2xl p-5 border-2 transition-all flex items-start gap-4"
            style={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
            data-testid="button-choice-companion"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">
              <Pill size={20} />
            </div>
            <div>
              <p className="font-bold text-foreground">Companion Medication</p>
              <p className="text-xs text-muted-foreground mt-1">
                Save other prescribed medications for reference and provider reports. No dose tracking or reminders.
              </p>
            </div>
          </motion.button>
        </div>
      </SheetContent>
    </Sheet>
  );
}