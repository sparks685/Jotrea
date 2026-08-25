import { FileHeart, Share2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PlusGate } from "@/components/PlusGate";
import { Button } from "@/components/ui/button";
import { useDoses, useMedication, useUser, useWeights } from "@/hooks/useMedication";
import { dosesForMedication } from "@/utils/medicationDoses";

export default function VisitSummary() {
  const { user } = useUser();
  const { medication } = useMedication();
  const { doses } = useDoses();
  const { weights } = useWeights();
  const currentDoses = medication ? dosesForMedication(doses, medication, user.legacyDoseMedicationId) : [];
  const taken = currentDoses.filter((dose) => dose.taken).length;
  const symptoms = [...new Set(currentDoses.flatMap((dose) => dose.sideEffects ?? []))];

  const summaryText = [
    "Jotrea provider visit summary",
    `Tracker: ${user.name || "Not provided"}`,
    `Current prescribed medication recorded: ${medication ? `${medication.brandName}, ${medication.dose} mg, ${medication.frequency}` : "None"}`,
    `Recorded doses: ${taken} taken of ${currentDoses.length} entries`,
    `Weight entries: ${weights.length}`,
    `Recorded symptoms: ${symptoms.join(", ") || "None"}`,
    "This is a user-recorded tracker summary and does not provide medical advice or dosage recommendations.",
  ].join("\n");

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Jotrea provider visit summary", text: summaryText });
      return;
    }
    await navigator.clipboard.writeText(summaryText);
  };

  return (
    <PlusGate feature="Provider Visit Summary">
      <PageContainer className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Provider Visit Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">A concise view of the information you recorded.</p>
        </div>
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm" data-testid="card-visit-summary">
          <div className="mb-5 flex items-center gap-3 border-b border-border pb-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileHeart size={21} /></span>
            <div>
              <h2 className="font-bold text-foreground">Tracking overview</h2>
              <p className="text-xs text-muted-foreground">Prepared {new Date().toLocaleDateString()}</p>
            </div>
          </div>
          <SummaryRow label="Tracker" value={user.name || "Not provided"} />
          <SummaryRow label="Current prescribed medication" value={medication ? `${medication.brandName} · ${medication.dose} mg · ${medication.frequency}` : "None recorded"} />
          <SummaryRow label="Dose entries" value={`${taken} taken of ${currentDoses.length} recorded`} />
          <SummaryRow label="Weight entries" value={String(weights.length)} />
          <SummaryRow label="Recorded symptoms" value={symptoms.join(", ") || "None recorded"} />
          <p className="mt-5 rounded-xl bg-muted p-3 text-[11px] leading-relaxed text-muted-foreground">
            This summary reflects user-recorded information only. Jotrea does not calculate, recommend, modify, or verify dosages or medical care.
          </p>
        </section>
        <Button className="w-full rounded-xl gap-2" onClick={() => void share()} data-testid="button-share-visit-summary">
          <Share2 size={15} /> Share summary
        </Button>
      </PageContainer>
    </PlusGate>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/60 py-3 last:border-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}