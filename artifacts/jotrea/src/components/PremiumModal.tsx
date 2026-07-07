import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check } from "lucide-react";
import { useUser } from "@/hooks/useMedication";
import { addMonths, format } from "date-fns";

const features = [
  "Track multiple medications",
  "Side effect journal",
  "Food & meal logging",
  "Progress photos",
  "Apple Health sync",
  "PDF export for doctors",
];

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
}

export function PremiumModal({ open, onClose }: PremiumModalProps) {
  const { user, setUser } = useUser();

  const handleUpgrade = () => {
    setUser({
      ...user,
      subscription: "premium",
      trialEndDate: format(addMonths(new Date(), 1), "yyyy-MM-dd"),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-amber-400 to-amber-600 px-6 pt-8 pb-6 text-white text-center">
          <div className="bg-white/20 rounded-full w-14 h-14 flex items-center justify-center mx-auto mb-3">
            <Crown size={28} className="fill-white text-white" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-white text-xl font-bold">Unlock Jotrea Premium</DialogTitle>
          </DialogHeader>
          <p className="text-amber-100 text-sm mt-1">Start your 1-month free trial today</p>
        </div>

        <div className="p-6 space-y-5">
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3">
                <div className="bg-secondary/20 rounded-full p-0.5">
                  <Check size={14} className="text-secondary" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-foreground">{f}</span>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-3">
            <div className="border-2 border-primary rounded-2xl p-3 text-center relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                Best Value
              </span>
              <p className="text-lg font-bold text-foreground">$29.99</p>
              <p className="text-xs text-muted-foreground">per year</p>
              <p className="text-[10px] text-primary font-medium mt-0.5">Save 40%</p>
            </div>
            <div className="border border-border rounded-2xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">$4.99</p>
              <p className="text-xs text-muted-foreground">per month</p>
            </div>
          </div>

          <Button
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl h-12 text-base shadow-lg"
            onClick={handleUpgrade}
            data-testid="start-free-trial"
          >
            Start Free Trial
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Cancel anytime. No charge for 30 days.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
