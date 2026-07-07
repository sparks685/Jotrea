import { Crown } from "lucide-react";

interface PremiumBadgeProps {
  variant?: "free" | "premium";
  size?: "sm" | "md";
}

export function PremiumBadge({ variant = "free", size = "md" }: PremiumBadgeProps) {
  const isSm = size === "sm";

  if (variant === "premium") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-semibold ${
          isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
        } bg-amber-100 text-amber-700 border border-amber-200`}
        data-testid="premium-badge"
      >
        <Crown size={isSm ? 11 : 13} className="fill-amber-500 text-amber-500" />
        Premium
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${
        isSm ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      } bg-muted text-muted-foreground border border-border`}
      data-testid="free-badge"
    >
      Free Plan
    </span>
  );
}
