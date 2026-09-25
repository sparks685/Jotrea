import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Droplets, Activity, Target, CheckCircle2 } from "lucide-react";
import { useDailyTargets } from "@/hooks/useDailyTargets";
import { DailyTargetSheet } from "@/components/DailyTargetSheet";
import { computeProgress, formatCups, resolveGoals } from "@/utils/dailyTargets";
import type { UserData } from "@/types";
import type { DailyTargetKey } from "@/types/dailyTargets";
import "@/pages/dashboard-layout.css";

export function DailyTargetsCard({ user }: { user: UserData }) {
  const api = useDailyTargets();
  const [location] = useLocation();
  const [open, setOpen] = useState<DailyTargetKey | null>(null);
  const goals = resolveGoals(user);
  const progress = computeProgress(api.getDay(api.today), goals, api.cupMl);

  useEffect(() => setOpen(null), [location]);

  const items = [
    { key: "water" as const, icon: <Droplets size={20} className="text-blue-500" />, label: "Water", goal: `${goals.waterCups} cups`, logged: `${formatCups(progress.water.current)} cups logged` },
    { key: "protein" as const, icon: <Activity size={20} className="text-red-400" />, label: "Protein", goal: goals.proteinG ? `${goals.proteinG} g` : null, logged: `${progress.protein.current} g logged` },
    { key: "steps" as const, icon: <Target size={20} className="text-green-500" />, label: "Steps", goal: `${goals.steps.toLocaleString()} steps`, logged: `${progress.steps.current.toLocaleString()} steps logged` },
  ];

  return (
    <section aria-label="Today's Targets" className="daily-targets-card bg-card rounded-3xl p-4 shadow-sm border border-border">
      <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Today's Targets</h2>
      <div className="daily-targets-list">
        {items.map((item) => {
          const p = progress[item.key];
          const done = p.complete;
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setOpen(item.key)}
              data-testid={`daily-target-${item.key}`}
              data-complete={done}
              aria-haspopup="dialog"
              aria-label={`${item.label}: ${p.legacyOnly ? "Legacy check" : item.logged}, ${item.goal ? `goal ${item.goal}` : "no goal set"}${done ? ", goal reached" : ""}. Open log.`}
              className={`daily-target-row p-4 rounded-2xl border-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
                done ? "border-secondary bg-secondary/10" : "border-border bg-background"
              }`}
            >
              <span className="daily-target-summary">
                <span aria-hidden="true" className="shrink-0 mt-0.5">{item.icon}</span>
                <span className="daily-target-copy">
                  <span className="block text-sm font-bold text-foreground">{item.label}</span>
                  <span className="block text-sm font-semibold text-foreground mt-1" data-testid={`text-logged-${item.key}`}>
                    {p.legacyOnly ? "Legacy check" : item.logged}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-1">{item.goal ? `Daily goal: ${item.goal}` : "No protein goal set"}</span>
                </span>
                {done && <CheckCircle2 aria-hidden="true" size={18} className="shrink-0 text-secondary" />}
              </span>
              <span aria-hidden="true" className="daily-target-progress rounded-full bg-muted">
                <span className="block h-full bg-secondary" style={{ width: `${p.ratio * 100}%` }} />
              </span>
            </button>
          );
        })}
      </div>
      <DailyTargetSheet target={open} onClose={() => setOpen(null)} api={api} goals={goals} />
    </section>
  );
}
