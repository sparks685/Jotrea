import { useState } from "react";
import { BellPlus, CheckCircle2, Clock3, Plus, Trash2, Pill, Syringe, ChevronRight, Activity, History } from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { PageContainer } from "@/components/PageContainer";
import { BackToSettingsButton } from "@/components/BackToSettingsButton";
import { PlusGate } from "@/components/PlusGate";
import { ChangeMedicationSheet } from "@/components/ChangeMedicationSheet";
import { AddMedicationChoiceSheet } from "@/components/AddMedicationChoiceSheet";
import { AddCompanionSheet } from "@/components/AddCompanionSheet";
import { Button } from "@/components/ui/button";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDoses, useMedication, useUser, useCompanionMedications, useCabinetActivity } from "@/hooks/useMedication";
import type { CabinetMedication, MedicationData, CompanionMedication } from "@/types";
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
  const { companions, setCompanions } = useCompanionMedications();
  const { activity, logActivity } = useCabinetActivity();
  const [stored, setStored] = useLocalStorage<CabinetMedication[]>("jotrea_medication_cabinet", []);
  const cabinet = Array.isArray(stored) ? stored : [];

  const [choiceSheetOpen, setChoiceSheetOpen] = useState(false);
  const [trackerSheetOpen, setTrackerSheetOpen] = useState(false);
  const [companionSheetOpen, setCompanionSheetOpen] = useState(false);

  const currentTrackerId = medication ? getMedicationTrackingId(medication) : null;
  const currentTracker = cabinet.find((c) => c.cabinetId === currentTrackerId);
  const previousTrackers = cabinet.filter((c) => c.cabinetId !== currentTrackerId);

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
    logActivity({ type: "started", medicationName: item.brandName || item.genericName, details: `Recorded dose: ${item.dose} mg` });
    rescheduleAfterCabinetChange(nextCabinet, item, legacyDoseMedicationId);
  };

  const handleAddTracker = (next: MedicationData) => {
    const item = createCabinetMedication(next);
    const nextCabinet = [...cabinet, item];
    setStored(nextCabinet);
    if (medication && !user.legacyDoseMedicationId) {
      setUser({ ...user, legacyDoseMedicationId: getMedicationTrackingId(medication) });
    }
    setMedication(item);
    logActivity({ type: "started", medicationName: item.brandName || item.genericName, details: `Recorded dose: ${item.dose} mg` });
    rescheduleAfterCabinetChange(nextCabinet, item);
  };

  const handleAddCompanion = (med: Omit<CompanionMedication, "id" | "createdAt">) => {
    const newMed: CompanionMedication = {
      ...med,
      id: `comp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setCompanions([...companions, newMed]);
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

  const removeCompanion = (id: string) => {
    setCompanions(companions.filter((c) => c.id !== id));
  };

  const renderTrackerCard = (item: CabinetMedication, isActive: boolean) => {
    return (
      <div key={item.cabinetId} className={`rounded-3xl border bg-card shadow-sm overflow-hidden flex flex-col ${isActive ? "border-2 border-[#D4A574]" : "border-border"}`} data-testid={`card-tracker-${item.cabinetId}`}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground">{item.nickname || item.brandName}</h3>
                {isActive && <CheckCircle2 size={15} className="text-[#D4A574]" aria-label="Current Tracker" />}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.dose} mg · {item.frequency.replace("-", " ")}</p>
            </div>
            <button
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
              onClick={() => {
                const nextCabinet = cabinet.filter((candidate) => candidate.cabinetId !== item.cabinetId);
                setStored(nextCabinet);
                rescheduleAfterCabinetChange(nextCabinet);
                logActivity({ type: "removed", medicationName: item.brandName || item.genericName, details: `${item.dose} mg` });
              }}
              data-testid={`button-remove-tracker-${item.cabinetId}`}
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
                  aria-label={`Time for reminder ${index + 1}`}
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
                className="flex items-center gap-2 text-xs font-semibold text-[#D4A574]"
                onClick={() => addReminder(item.cabinetId)}
                data-testid={`button-add-reminder-${item.cabinetId}`}
                aria-label={`Add reminder time for ${item.brandName}`}
              >
                <BellPlus size={14} /> Add reminder time
              </button>
            )}
          </div>

          {!isActive && (
            <Button variant="outline" size="sm" className="mt-4 w-full rounded-xl" onClick={() => {
              setMedication(item);
              rescheduleAfterCabinetChange(cabinet, item);
              logActivity({ type: "switched", medicationName: item.brandName || item.genericName, details: `${item.dose} mg` });
            }} data-testid={`button-use-tracker-${item.cabinetId}`}>
              Use as current tracker
            </Button>
          )}
        </div>

        <Link href={`/medication-cabinet/${item.cabinetId}`} className="bg-muted/30 px-5 py-3 border-t border-border flex items-center justify-between hover:bg-muted/50 transition-colors" data-testid={`link-detail-${item.cabinetId}`} aria-label={`View tracker history and context for ${item.brandName}`}>
          <span className="text-xs font-semibold text-muted-foreground">View tracker history & context</span>
          <ChevronRight size={14} className="text-muted-foreground" />
        </Link>
      </div>
    );
  };

  return (
    <PlusGate feature="Medication Cabinet">
      <AddMedicationChoiceSheet
        open={choiceSheetOpen}
        onOpenChange={setChoiceSheetOpen}
        onSelectTracker={() => setTrackerSheetOpen(true)}
        onSelectCompanion={() => setCompanionSheetOpen(true)}
      />
      <ChangeMedicationSheet
        open={trackerSheetOpen}
        onOpenChange={setTrackerSheetOpen}
        onConfirm={handleAddTracker}
        injectionSiteHistory={user.injectionSiteHistory}
        currentMedication={medication}
        pastDoseCount={doses.length}
        title="Add GLP-1 Tracker"
      />
      <AddCompanionSheet
        open={companionSheetOpen}
        onOpenChange={setCompanionSheetOpen}
        onConfirm={handleAddCompanion}
      />

      <PageContainer className="space-y-8 pb-20">
        <BackToSettingsButton />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medication History & Context</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A safe, private record of your trackers and companion medications for your reference.
          </p>
        </div>

        {cabinet.length === 0 && companions.length === 0 && (
          <p className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
            Track your GLP-1 journey, recorded dose changes, and companion medications in one place.
          </p>
        )}

        {medication && !currentTracker && (
          <Button variant="outline" className="w-full rounded-xl border-[#D4A574] text-[#D4A574]" onClick={ensureCurrent} data-testid="button-add-current-medication">
            Add current tracker to cabinet
          </Button>
        )}

        {activity.length > 0 && (
          <section>
            <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity size={14} /> Activity Timeline
            </h2>
            <div className="rounded-3xl border border-border bg-card p-5 shadow-sm space-y-4">
              {activity.slice(0, 4).map((act, index) => (
                <div key={act.id} className="relative flex gap-4" data-testid={`timeline-event-${act.id}`}>
                  {index !== Math.min(activity.length, 4) - 1 && (
                    <div className="absolute left-[5px] top-5 bottom-[-16px] w-[2px] bg-muted"></div>
                  )}
                  <div className="w-3 h-3 rounded-full bg-border mt-1.5 flex-shrink-0 z-10"></div>
                  <div className="flex-1 pb-2">
                    <p className="text-xs text-muted-foreground mb-0.5">{format(parseISO(act.date), "MMM d, yyyy")}</p>
                    <p className="text-sm font-medium text-foreground">
                      {act.type === "added" ? "Added " : act.type === "switched" ? "Changed current tracker to " : act.type === "removed" ? "Removed " : "Started tracking "}
                      <span className="font-bold">{act.medicationName}</span>
                    </p>
                    {act.details && <p className="text-xs text-muted-foreground mt-0.5">{act.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-8">
          {cabinet.length === 0 ? (
            <section>
              <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                <Syringe size={14} /> GLP-1 Trackers
              </h2>
              <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center" data-testid="status-cabinet-empty">
                <p className="font-semibold text-foreground text-sm">No trackers saved</p>
                <p className="mt-1 text-xs text-muted-foreground">Add a tracker from your prescribed label.</p>
              </div>
            </section>
          ) : (
            <>
              {currentTracker && (
                <section>
                  <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2 text-[#D4A574]">
                    <Syringe size={14} /> Current GLP-1 Tracker
                  </h2>
                  <div className="space-y-3">
                    {renderTrackerCard(currentTracker, true)}
                  </div>
                </section>
              )}

              {previousTrackers.length > 0 && (
                <section>
                  <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                    <History size={14} /> Previous / Other Trackers
                  </h2>
                  <div className="space-y-3">
                    {previousTrackers.map(t => renderTrackerCard(t, false))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* Companion Medications Section */}
          <section>
            <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <Pill size={14} /> Companion Medications
            </h2>
            <div className="space-y-3">
              {companions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card p-6 text-center" data-testid="status-companions-empty">
                  <p className="font-semibold text-foreground text-sm">No companions saved</p>
                <p className="mt-1 text-xs text-muted-foreground">Add other prescribed medications for reference only.</p>
                </div>
              ) : companions.map((comp) => (
                <div key={comp.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm" data-testid={`card-companion-${comp.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{comp.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {comp.dose} · {comp.frequency} · {comp.timeOfDay}
                      </p>
                      {comp.purpose && (
                        <p className="mt-2 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md inline-block">
                          For: {comp.purpose}
                        </p>
                      )}
                    </div>
                    <button
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted flex-shrink-0"
                      onClick={() => removeCompanion(comp.id)}
                      data-testid={`button-remove-companion-${comp.id}`}
                      aria-label={`Remove ${comp.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <Button className="w-full rounded-2xl h-14 gap-2 text-sm font-bold mt-4" style={{ backgroundColor: "#D4A574", color: "white" }} onClick={() => setChoiceSheetOpen(true)} data-testid="button-add-medication-choice">
          <Plus size={18} /> Add to Cabinet
        </Button>
      </PageContainer>
    </PlusGate>
  );
}