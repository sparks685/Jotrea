import { useParams, Link, useLocation } from "wouter";
import { ChevronLeft, Info, Calendar, Target, Scale, Activity } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDoses, useWeights, useUser, useCabinetActivity, useMedication } from "@/hooks/useMedication";
import { dosesForMedication, getMedicationTrackingId } from "@/utils/medicationDoses";
import { buildRecordedDoseRanges, getFrequentRecordedSymptoms, getWeightContext } from "@/utils/medicationContext";
import { cancelAllNotifications, rescheduleAllNotifications } from "@/utils/notifications";
import { format, parseISO } from "date-fns";
import type { CabinetMedication } from "@/types";

export default function CabinetDetail() {
  const params = useParams<{ cabinetId: string }>();
  const cabinetId = params.cabinetId;
  const [, setLocation] = useLocation();
  const [stored, setStored] = useLocalStorage<CabinetMedication[]>("jotrea_medication_cabinet", []);
  const cabinet = Array.isArray(stored) ? stored : [];
  const { doses } = useDoses();
  const { weights } = useWeights();
  const { user } = useUser();
  const { medication, setMedication } = useMedication();
  const { logActivity } = useCabinetActivity();

  const item = cabinet.find((c) => c.cabinetId === cabinetId);

  if (!item) {
    return (
      <PageContainer className="space-y-6">
        <div className="flex items-center gap-2">
          <Link href="/medication-cabinet" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors" data-testid="link-back-cabinet">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Tracker Not Found</h1>
        </div>
      </PageContainer>
    );
  }

  const isCurrent = medication != null && getMedicationTrackingId(medication) === item.cabinetId;
  const trackerDoses = [...dosesForMedication(doses, item, user.legacyDoseMedicationId)]
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const firstDose = trackerDoses[0] ?? null;
  const lastDose = trackerDoses[trackerDoses.length - 1] ?? null;
  const periodEnd = isCurrent ? null : (lastDose?.date ?? item.startDate);
  const weightContext = getWeightContext(weights, item.startDate, periodEnd);
  const frequentSymptoms = getFrequentRecordedSymptoms(trackerDoses);
  const doseRanges = buildRecordedDoseRanges(trackerDoses, isCurrent);

  const saveRefillDate = (date: string) => {
    const nextCabinet = cabinet.map((c) =>
      c.cabinetId === item.cabinetId ? { ...c, refillReminderDate: date } : c
    );
    setStored(nextCabinet);
  };

  const handleSetCurrent = () => {
    setMedication(item);
    logActivity({ type: "switched", medicationName: item.brandName || item.genericName, details: `${item.dose} mg` });
    if (!user.notificationsEnabled) return;
    const primaryDoses = dosesForMedication(doses, item, user.legacyDoseMedicationId);
    void rescheduleAllNotifications(item, primaryDoses, user, {
      allDoses: doses,
      cabinetMedications: cabinet,
    });
  };

  const handleRemove = () => {
    const nextCabinet = cabinet.filter((c) => c.cabinetId !== item.cabinetId);
    setStored(nextCabinet);
    logActivity({ type: "removed", medicationName: item.brandName || item.genericName, details: `${item.dose} mg` });
    
    if (user.notificationsEnabled && medication) {
      const primaryDoses = dosesForMedication(doses, medication, user.legacyDoseMedicationId);
      void rescheduleAllNotifications(medication, primaryDoses, user, {
         allDoses: doses,
         cabinetMedications: nextCabinet,
      });
    } else if (!medication) {
      void cancelAllNotifications();
    }
    setLocation("/medication-cabinet");
  };

  const takenCount = trackerDoses.filter(d => d.taken).length;

  return (
    <PageContainer className="space-y-6 pb-20">
      <div className="flex items-center gap-2">
        <Link href="/medication-cabinet" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors" data-testid="link-back-cabinet">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Tracker Context</h1>
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#D4A574]/10 text-[#D4A574]">
            <Info size={20} />
          </div>
          <div>
            <h2 className="font-bold text-foreground text-lg">{item.nickname || item.brandName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.genericName} • {item.dose} mg • {item.frequency.replace("-", " ")}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
          This is a factual record of your activity while using this tracker. It does not contain medical advice or calculate next steps.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Target size={14} /> Recorded Doses
        </h3>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-3xl font-black text-foreground">
                {takenCount} <span className="text-lg text-muted-foreground font-semibold">/ {trackerDoses.length}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Doses taken out of recorded</p>
            </div>
            {firstDose && lastDose && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">From</p>
                <p className="text-sm font-semibold text-foreground">{format(parseISO(firstDose.date), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {weightContext && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Scale size={14} /> Weight Context
          </h3>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">During this period</p>
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-xl font-bold text-foreground">
                  {weightContext.change > 0 ? "+" : ""}{weightContext.change.toFixed(1)} {user.units}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{weightContext.start} → {weightContext.end}</p>
              <p>{weightContext.entryCount} recorded {weightContext.entryCount === 1 ? "entry" : "entries"}</p>
            </div>
          </div>
        </div>
      )}

      {doseRanges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Activity size={14} /> Recorded Amounts
          </h3>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
            {doseRanges.map((range, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0 last:pb-0" data-testid={`dose-range-${idx}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">{range.amount} mg</p>
                  <p className="text-xs font-medium text-muted-foreground">{range.duration}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(range.startDate), "MMM d, yyyy")} – {range.endDate ? format(parseISO(range.endDate), "MMM d, yyyy") : "Present"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {frequentSymptoms.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
            <Info size={14} /> Frequent Symptoms
          </h3>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-wrap gap-2">
            {frequentSymptoms.map(([symptom, count]) => (
              <div key={symptom} className="bg-muted px-3 py-1.5 rounded-lg text-xs text-foreground font-medium">
                {symptom} <span className="text-muted-foreground ml-1">({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <Calendar size={14} /> Refill Reference Date
        </h3>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground mb-3">
            For your own reference. Not synced with any pharmacy.
          </p>
          <label className="block text-xs font-semibold text-foreground mb-1">
            Date <span className="text-muted-foreground font-normal ml-1">(Entered by you)</span>
          </label>
          <input
            type="date"
            value={item.refillReminderDate || ""}
            onChange={(e) => saveRefillDate(e.target.value)}
            className="w-full rounded-xl bg-muted border-0 h-10 px-3 text-sm text-foreground"
            data-testid="input-refill-date"
            aria-label="Refill reference date"
          />
        </div>
      </div>

      <div className="space-y-3 pt-6 border-t border-border/50">
        {!isCurrent && (
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={handleSetCurrent}
            data-testid="button-set-current"
          >
            Set as current tracker
          </Button>
        )}
        <Button
          variant="destructive"
          className="w-full rounded-xl"
          onClick={handleRemove}
          data-testid="button-remove-from-cabinet"
        >
          Remove from cabinet
        </Button>
      </div>
    </PageContainer>
  );
}