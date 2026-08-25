import { Activity, Scale, TrendingDown } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PlusGate } from "@/components/PlusGate";
import { useDoses, useUser, useWeights } from "@/hooks/useMedication";

export default function AdvancedTrends() {
  const { weights } = useWeights();
  const { doses } = useDoses();
  const { user } = useUser();
  const orderedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const change = orderedWeights.length > 1
    ? orderedWeights[orderedWeights.length - 1].weight - orderedWeights[0].weight
    : null;
  const symptoms = doses.flatMap((dose) => dose.sideEffects ?? []);
  const symptomCounts = Object.entries(
    symptoms.reduce<Record<string, number>>((counts, symptom) => {
      counts[symptom] = (counts[symptom] ?? 0) + 1;
      return counts;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <PlusGate feature="Advanced Trends">
      <PageContainer className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Advanced Trends</h1>
          <p className="mt-1 text-sm text-muted-foreground">See patterns across the information you recorded.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric icon={<Scale size={17} />} label="Weight entries" value={String(weights.length)} />
          <Metric
            icon={<TrendingDown size={17} />}
            label="Recorded change"
            value={change == null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} ${user.units}`}
          />
        </div>
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity size={17} className="text-primary" />
            <h2 className="font-bold text-foreground">Recorded symptom frequency</h2>
          </div>
          <div className="mt-4 space-y-3">
            {symptomCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="status-trends-empty">No symptoms recorded yet.</p>
            ) : symptomCounts.map(([symptom, count]) => (
              <div key={symptom}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-foreground">{symptom}</span>
                  <span className="font-semibold text-muted-foreground">{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(10, count / symptomCounts[0][1] * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">
            These charts summarize your entries only. They do not interpret symptoms or recommend changes to prescribed information.
          </p>
        </section>
      </PageContainer>
    </PlusGate>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="text-primary">{icon}</span>
      <p className="mt-3 text-xl font-bold text-foreground" data-testid={`text-metric-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}