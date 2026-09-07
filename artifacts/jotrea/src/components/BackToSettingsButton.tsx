import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";

export function BackToSettingsButton() {
  const [, setLocation] = useLocation();

  return (
    <button
      type="button"
      className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => setLocation("/settings")}
      aria-label="Back to Settings"
      data-testid="button-back-to-settings"
    >
      <ChevronLeft size={22} aria-hidden="true" />
      Settings
    </button>
  );
}