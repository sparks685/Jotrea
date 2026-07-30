import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth, addWeeks, addMonths, isBefore, isAfter } from "date-fns";
import type { DoseEntry } from "@/types";

const SIDE_EFFECTS_LIST = [
  { id: "nausea", label: "Nausea", emoji: "🤢" },
  { id: "fatigue", label: "Fatigue", emoji: "😴" },
  { id: "headache", label: "Headache", emoji: "🤕" },
  { id: "constipation", label: "Constipation", emoji: "😣" },
  { id: "diarrhea", label: "Diarrhea", emoji: "🏃" },
  { id: "dizziness", label: "Dizziness", emoji: "😵" },
  { id: "site_reaction", label: "Site rxn", emoji: "💉" },
  { id: "low_appetite", label: "Low appetite", emoji: "🍽️" },
];

type Period = "total" | "weekly" | "monthly";

interface Props {
  doses: DoseEntry[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          {p.name ? `${p.name}: ` : ""}<span className="font-bold text-primary">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function SideEffectTrendsChart({ doses }: Props) {
  const [period, setPeriod] = useState<Period>("total");
  const [focusedEffect, setFocusedEffect] = useState<string | null>(null);

  // Only doses that have actual side effects (not "none")
  const dosesWithEffects = useMemo(
    () => doses.filter((d) => d.sideEffects?.some((e) => e !== "none")),
    [doses]
  );

  const totalsData = useMemo(() => {
    return SIDE_EFFECTS_LIST.map((effect) => ({
      id: effect.id,
      emoji: effect.emoji,
      name: `${effect.emoji} ${effect.label}`,
      shortName: effect.emoji,
      label: effect.label,
      count: dosesWithEffects.filter((d) => d.sideEffects?.includes(effect.id)).length,
    })).filter((d) => d.count > 0);
  }, [dosesWithEffects]);

  const timeSeriesData = useMemo(() => {
    if (dosesWithEffects.length === 0) return [];

    const sorted = [...dosesWithEffects].sort((a, b) => a.date.localeCompare(b.date));
    const earliest = parseISO(sorted[0].date);
    const latest = parseISO(sorted[sorted.length - 1].date);

    if (period === "weekly") {
      const buckets: { periodKey: string; label: string; effects: string[] }[] = [];
      let cursor = startOfWeek(earliest, { weekStartsOn: 0 });
      while (!isAfter(cursor, latest)) {
        const nextCursor = addWeeks(cursor, 1);
        const effects = dosesWithEffects
          .filter((d) => {
            const date = parseISO(d.date);
            return !isBefore(date, cursor) && isBefore(date, nextCursor);
          })
          .flatMap((d) => d.sideEffects?.filter((e) => e !== "none") ?? []);
        buckets.push({ periodKey: format(cursor, "yyyy-MM-dd"), label: format(cursor, "MMM d"), effects });
        cursor = nextCursor;
      }
      const activeEffects = totalsData.map((t) => t.id);
      return buckets.map(({ label, effects }) => {
        const row: Record<string, string | number> = { label };
        activeEffects.forEach((id) => { row[id] = effects.filter((e) => e === id).length; });
        return row;
      });
    }

    if (period === "monthly") {
      const buckets: { periodKey: string; label: string; effects: string[] }[] = [];
      let cursor = startOfMonth(earliest);
      while (!isAfter(cursor, latest)) {
        const nextCursor = addMonths(cursor, 1);
        const effects = dosesWithEffects
          .filter((d) => {
            const date = parseISO(d.date);
            return !isBefore(date, cursor) && isBefore(date, nextCursor);
          })
          .flatMap((d) => d.sideEffects?.filter((e) => e !== "none") ?? []);
        buckets.push({ periodKey: format(cursor, "yyyy-MM"), label: format(cursor, "MMM yyyy"), effects });
        cursor = nextCursor;
      }
      const activeEffects = totalsData.map((t) => t.id);
      return buckets.map(({ label, effects }) => {
        const row: Record<string, string | number> = { label };
        activeEffects.forEach((id) => { row[id] = effects.filter((e) => e === id).length; });
        return row;
      });
    }

    return [];
  }, [dosesWithEffects, period, totalsData]);

  if (dosesWithEffects.length === 0) {
    return (
      <div className="bg-card rounded-3xl p-5 shadow-sm border border-border" data-testid="side-effect-trends-chart">
        <h3 className="font-semibold text-foreground text-sm mb-1">Side Effect Trends</h3>
        <p className="text-xs text-muted-foreground mb-4">Track how your side effects change over time</p>
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <span className="text-3xl">📊</span>
          <p className="text-sm font-medium text-foreground">No side effects logged yet</p>
          <p className="text-xs text-muted-foreground">When you log doses with side effects, trends will appear here</p>
        </div>
      </div>
    );
  }

  const activeEffects = totalsData.map((t) => t.id);
  // Color palette for lines/bars in the time-series chart
  const effectColors: Record<string, string> = {
    nausea: "hsl(var(--primary))",
    fatigue: "hsl(var(--secondary))",
    headache: "#f59e0b",
    constipation: "#8b5cf6",
    diarrhea: "#ef4444",
    dizziness: "#06b6d4",
    site_reaction: "#84cc16",
    low_appetite: "#f97316",
  };

  const hasSingleEffect = totalsData.length === 1;

  return (
    <div className="bg-card rounded-3xl p-5 shadow-sm border border-border space-y-4" data-testid="side-effect-trends-chart">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">Side Effect Trends</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{dosesWithEffects.length} dose{dosesWithEffects.length !== 1 ? "s" : ""} with side effects</p>
        </div>
        <div className="bg-muted rounded-xl flex p-0.5 gap-0.5">
          {(["total", "weekly", "monthly"] as Period[]).map((p) => (
            <button
              key={p}
              data-testid={`trend-period-${p}`}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                period === p ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"
              }`}
              onClick={() => setPeriod(p)}
            >
              {p === "total" ? "Total" : p === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {period === "total" ? (
        <div data-testid="chart-total">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={totalsData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={hasSingleEffect ? 32 : undefined}>
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 14 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 6 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
            {totalsData.map((d) => (
              <div key={d.id} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span>{d.emoji}</span>
                <span>{d.label}</span>
                <span className="font-bold text-foreground">×{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : timeSeriesData.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2" data-testid="chart-insufficient-data">
          <p className="text-sm font-medium text-foreground">Not enough data yet</p>
          <p className="text-xs text-muted-foreground">Log doses across multiple {period === "weekly" ? "weeks" : "months"} to see trends</p>
        </div>
      ) : (
        <div data-testid={`chart-${period}`}>
          {/* Effect toggle pills for time series */}
          {activeEffects.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {totalsData.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setFocusedEffect(focusedEffect === d.id ? null : d.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                    focusedEffect === null || focusedEffect === d.id
                      ? "border-transparent text-white"
                      : "border-border bg-card text-muted-foreground opacity-50"
                  }`}
                  style={
                    focusedEffect === null || focusedEffect === d.id
                      ? { backgroundColor: effectColors[d.id] ?? "hsl(var(--primary))" }
                      : {}
                  }
                >
                  {d.emoji} {d.label}
                </button>
              ))}
            </div>
          )}
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeSeriesData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              {activeEffects
                .filter((id) => focusedEffect === null || focusedEffect === id)
                .map((id) => {
                  const effect = SIDE_EFFECTS_LIST.find((e) => e.id === id);
                  return (
                    <Line
                      key={id}
                      type="monotone"
                      dataKey={id}
                      name={effect ? `${effect.emoji} ${effect.label}` : id}
                      stroke={effectColors[id] ?? "hsl(var(--primary))"}
                      strokeWidth={2}
                      dot={{ r: 3, fill: effectColors[id] ?? "hsl(var(--primary))" }}
                      activeDot={{ r: 5 }}
                    />
                  );
                })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
