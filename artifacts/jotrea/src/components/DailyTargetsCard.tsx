import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Droplets, Activity, Target, CheckCircle2 } from "lucide-react";
import { useDailyTargets } from "@/hooks/useDailyTargets";
import { DailyTargetSheet } from "@/components/DailyTargetSheet";
import { computeProgress, formatCups, resolveGoals } from "@/utils/dailyTargets";
import type { UserData } from "@/types";
import type { DailyTargetKey } from "@/types/dailyTargets";

export function DailyTargetsCard({ user }: { user: UserData }) {
  const api = useDailyTargets();
  const [location] = useLocation();
  const [open, setOpen] = useState<DailyTargetKey | null>(null);
  const goals = resolveGoals(user);
  const progress = computeProgress(api.getDay(api.today), goals, api.cupMl);

  useEffect(() => setOpen(null), [location]);

  const items = [
    { key: "water" as const, icon: <Droplets size={16} className="text-blue-500" />, label: "Water", value: `${goals.waterCups}`, unit: "cups", logged: `${formatCups(progress.water.current)} logged` },
    { key: "protein" as const, icon: <Activity size={16} className="text-red-400" />, label: "Protein", value: goals.proteinG ? `${goals.proteinG}g` : "—", unit: "goal", logged: `${progress.protein.current} g logged` },
    { key: "steps" as const, icon: <Target size={16} className="text-green-500" />, label: "Steps", value: goals.steps.toLocaleString(), unit: "/day", logged: `${progress.steps.current.toLocaleString()} logged` },
  ];

  return (
    <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Today's Targets</p>
      <div className="grid grid-cols-3 gap-2">
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
              aria-label={`${item.label}: ${item.logged}${done ? ", goal reached" : ""}. Open log.`}
              className={`relative overflow-hidden flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all active:scale-95 ${
                done ? "border-secondary bg-secondary/10" : "border-border bg-background"
              }`}
            >
              <div className={done ? "opacity-100" : "opacity-60"}>{item.icon}</div>
              <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{item.label}</p>
              <p className={`text-sm font-bold ${done ? "text-secondary" : "text-foreground"}`}>{item.value}</p>
              <p className="text-[9px] text-muted-foreground">{item.unit}</p>
              <p className="text-[9px] font-semibold text-foreground/70" data-testid={`text-logged-${item.key}`}>
                {p.legacyOnly ? "Legacy check" : item.logged}
              </p>
              {done && <CheckCircle2 size={12} className="text-secondary" />}
              <span aria-hidden className="absolute left-0 bottom-0 h-1 w-full bg-muted">
                <span className="block h-full bg-secondary origin-left transition-transform duration-500" style={{ transform: `scaleX(${p.ratio})` }} />
              </span>
            </button>
          );
        })}
      </div>
      <DailyTargetSheet target={open} onClose={() => setOpen(null)} api={api} goals={goals} />
    </div>
  );
}
