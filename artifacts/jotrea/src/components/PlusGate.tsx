import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useMedication";
import { isPremium } from "@/utils/featureGates";

export function PlusGate({ children, feature }: { children: ReactNode; feature: string }) {
  const { user } = useUser();
  const [, setLocation] = useLocation();

  if (isPremium(user.subscription)) return <>{children}</>;

  return (
    <div className="min-h-[70dvh] px-6 flex items-center justify-center">
      <div className="w-full rounded-3xl border border-primary/20 bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <LockKeyhole className="text-primary" size={24} />
        </div>
        <div className="mb-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary">
          <Sparkles size={13} /> Jotrea Plus
        </div>
        <h1 className="text-xl font-bold text-foreground">{feature}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Upgrade for expanded organization and reporting while your basic tracking, reminders,
          history, and CSV export stay free.
        </p>
        <Button
          className="mt-5 w-full rounded-xl"
          onClick={() => setLocation("/plus")}
          data-testid="button-open-plus"
        >
          Explore Jotrea Plus
        </Button>
      </div>
    </div>
  );
}