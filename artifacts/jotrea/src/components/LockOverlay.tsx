import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LockOverlayProps {
  label?: string;
  onUpgrade?: () => void;
}

export function LockOverlay({ label = "Premium Feature", onUpgrade }: LockOverlayProps) {
  return (
    <div className="absolute inset-0 rounded-2xl backdrop-blur-sm bg-background/70 flex flex-col items-center justify-center gap-2 z-10">
      <div className="bg-amber-100 rounded-full p-2.5">
        <Crown size={20} className="text-amber-600 fill-amber-400" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground text-center px-4">
        Upgrade to unlock this feature
      </p>
      {onUpgrade && (
        <Button
          size="sm"
          className="mt-1 bg-amber-500 hover:bg-amber-600 text-white"
          onClick={onUpgrade}
          data-testid="upgrade-from-lock"
        >
          Upgrade to Premium
        </Button>
      )}
    </div>
  );
}
