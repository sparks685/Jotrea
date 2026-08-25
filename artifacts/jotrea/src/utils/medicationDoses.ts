import type { DoseEntry, MedicationData } from "@/types";

/** Uses Cabinet identity when available so two entries for one medication can remain distinct. */
export function getMedicationTrackingId(medication: MedicationData): string {
  return medication.cabinetId ?? medication.id;
}

/**
 * The first time the original tracker is put into the Cabinet it gains a new,
 * stable cabinetId. Its untagged history must follow that identity rather than
 * the pre-Cabinet catalog id, otherwise the active view would appear empty.
 */
export function legacyOwnerForFirstCabinetActivation(
  cabinetMedication: MedicationData,
  existingLegacyOwner?: string
): string {
  return existingLegacyOwner ?? getMedicationTrackingId(cabinetMedication);
}

/**
 * Legacy entries predate Medication Cabinet. They remain attached to the
 * original tracker, never to every medication the user subsequently adds.
 */
export function dosesForMedication(
  doses: DoseEntry[],
  medication: MedicationData,
  legacyMedicationId?: string
): DoseEntry[] {
  const trackingId = getMedicationTrackingId(medication);
  const legacyOwner = legacyMedicationId ?? trackingId;
  return doses.filter((dose) =>
    dose.medicationId === trackingId ||
    (dose.medicationId === undefined && legacyOwner === trackingId)
  );
}