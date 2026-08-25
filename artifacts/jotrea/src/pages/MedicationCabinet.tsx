import { useState } from "react";
import { BellPlus, CheckCircle2, Clock3, Plus, Trash2 } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { PlusGate } from "@/components/PlusGate";
import { ChangeMedicationSheet } from "@/components/ChangeMedicationSheet";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDoses, useMedication, useUser } from "@/hooks/useMedication";
import type { CabinetMedication, MedicationData } from "@/types";
import {
  dosesForMedication,
  getMedicationTrackingId,
  legacyOwnerForFirstCabinetActivation,
} from "@/utils/medicationDoses";
import { cancelAllNotifications, rescheduleAllNotifications } from "@/utils/notifications";

function createCabinetMedication(medication: MedicationData): CabinetMedication {
  return {
    ...medication,
    cabinetId: `${medication.id}-${Date.now()}`,
    reminderTimes: [],
    createdAt: new Date().toISOString(),
  };
}

export default function MedicationCabinet() {
  const { user, setUser } = useUser();
  const { medication, setMedication } = useMedication();
  const { doses } = useDoses();
  const [stored, setStored] = useLocalStorage<CabinetMedication[]>("jotrea_medication_cabinet", []);
  const cabinet = Array.isArray(stored) ? stored : [];
  const [sheetOpen, setSheetOpen] = useState(false);

  const rescheduleAfterCabinetChange = (
    nextCabinet: CabinetMedication[],
    nextMedication: MedicationData | null = medication,
    legacyDoseMedicationId = user.legacyDoseMedicationId
  ) => {
    if (!user.notificationsEnabled) return;
    if (!nextMedication) {
      void cancelAllNotifications();
      return;
    }
    const primaryDoses = dosesForMedication(doses, nextMedication, legacyDoseMedicationId);
    void rescheduleAllNotifications(nextMedication, primaryDoses, user, {
      allDoses: doses,
      cabinetMedications: nextCabinet,
    });
  };

  const ensureCurrent = () => {
    if (!medication) return;
    const existing = cabinet.find((item) => item.id === medication.id && item.dose === medication.dose);
    if (existing) {
      setMedication(existing);
      rescheduleAfterCabinetChange(cabinet, existing);
      return;
    }
    const item = createCabinetMedication(medication);
    const nextCabinet = [...cabinet, item];
    setStored(nextCabinet);
    const legacyDoseMedicationId = legacyOwnerForFirstCabinetActivation(
      item,
      user.legacyDoseMedicationId
    );
    setUser({ ...user, legacyDoseMedicationId });
    setMedication(item);
    // State writes are asynchronous, so pass the new owner directly to the
    // rescheduler as well. Today's existing dose remains visible to it.
    rescheduleAfterCabinetChange(nextCabinet, item, legacyDoseMedicationId);
  };

  const handleAdd = (next: MedicationData) => {
    const item = createCabinetMedication(next);
    const nextCabinet = [...cabinet, item];
    setStored(nextCabinet);
    // Existing untagged history belongs to the medication that was active
    // before this new Cabinet tracker was selected.
    if (medication && !user.legacyDoseMedicationId) {
      setUser({ ...user, legacyDoseMedicationId: getMedicationTrackingId(medication) });
    }
    setMedication(item);
    rescheduleAfterCabinetChange(nextCabinet, item);
  };

  const addReminder = (cabinetId: string) => {
    const nextCabinet = cabinet.map((item) =>
      item.cabinetId === cabinetId && item.reminderTimes.length < 3
        ? { ...item, reminderTimes: [...item.reminderTimes, "09:00"] }
        : item
    );
    setStored(nextCabinet);
    rescheduleAfterCabinetChange(nextCabinet);
  };

  const updateReminder = (cabinetId: string, index: number, time: string) => {
    const nextCabinet = cabinet.map((item) =>
      item.cabinetId === cabinetId
        ? { ...item, reminderTimes: item.reminderTimes.map((value, i) => i === index ? time : value) }
        : item
    );
    setStored(nextCabinet);
    rescheduleAfterCabinetChange(nextCabinet);
  };

  const removeReminder = (cabinetId: string, index: number) => {
    const nextCabinet = cabinet.map((item) =>
      item.cabinetId === cabinetId
        ? { ...item, reminderTimes: item.reminderTimes.filter((_, i) => i !== index) }
        : item
    );
    setStored(nextCabinet);
    rescheduleAfterCabinetChange(nextCabinet);
  };

  return (
    <PlusGate feature="Medication Cabinet">
      <ChangeMedicationSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onConfirm={handleAdd}
        injectionSiteHistory={user.injectionSiteHistory}
        currentMedication={medication}
        pastDoseCount={doses.length}
      />
      <PageContainer className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medication Cabinet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organize medications and reminder times from information already prescribed by your healthcare provider.
          </p>
        </div>

        {medication && !cabinet.some((item) => item.id === medication.id && item.dose === medication.dose) && (
          <Button variant="outline" className="w-full rounded-xl" onClick={ensureCurrent} data-testid="button-add-current-medication">
            Add current medication to cabinet
          </Button>
        )}

        <div className="space-y-3">
          {cabinet.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-7 text-center" data-testid="status-cabinet-empty">
              <p className="font-semibold text-foreground">Your cabinet is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">Add a medication using its prescribed label information.</p>
            </div>
          ) : cabinet.map((item) => {
            const active = medication != null && getMedicationTrackingId(medication) === item.cabinetId;
            return (
              <div key={item.cabinetId} className="rounded-3xl border border-border bg-card p-5 shadow-sm" data-testid={`card-medication-${item.cabinetId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-foreground">{item.nickname || item.brandName}</h2>
                      {active && <CheckCircle2 size={15} className="text-secondary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.dose} mg · {item.frequency.replace("-", " ")}</p>
                  </div>
                  <button
                    className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                    onClick={() => {
                      const nextCabinet = cabinet.filter((candidate) => candidate.cabinetId !== item.cabinetId);
                      setStored(nextCabinet);
                      rescheduleAfterCabinetChange(nextCabinet);
                    }}
                    data-testid={`button-remove-medication-${item.cabinetId}`}
                    aria-label={`Remove ${item.brandName}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-4 space-y-2 border-t border-border pt-3">
                  {item.reminderTimes.map((time, index) => (
                    <label key={`${item.cabinetId}-${index}`} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-2"><Clock3 size={13} /> Additional reminder {index + 1}</span>
                      <input
                        type="time"
                        value={time}
                        onChange={(event) => updateReminder(item.cabinetId, index, event.target.value)}
                        className="rounded-lg bg-muted px-2 py-1 text-foreground"
                        data-testid={`input-reminder-${item.cabinetId}-${index}`}
                      />
                      <button
                        type="button"
                        className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted"
                        onClick={() => removeReminder(item.cabinetId, index)}
                        data-testid={`button-remove-reminder-${item.cabinetId}-${index}`}
                        aria-label={`Remove reminder ${index + 1}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </label>
                  ))}
                  {item.reminderTimes.length < 3 && (
                    <button
                      className="flex items-center gap-2 text-xs font-semibold text-primary"
                      onClick={() => addReminder(item.cabinetId)}
                      data-testid={`button-add-reminder-${item.cabinetId}`}
                    >
                      <BellPlus size={14} /> Add reminder time
                    </button>
                  )}
                </div>
                {!active && (
                  <Button variant="outline" size="sm" className="mt-4 w-full rounded-xl" onClick={() => {
                    setMedication(item);
                    rescheduleAfterCabinetChange(cabinet, item);
                  }} data-testid={`button-use-medication-${item.cabinetId}`}>
                    Use as current tracker
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        <Button className="w-full rounded-xl gap-2" onClick={() => setSheetOpen(true)} data-testid="button-add-medication">
          <Plus size={16} /> Add prescribed medication
        </Button>
      </PageContainer>
    </PlusGate>
  );
}