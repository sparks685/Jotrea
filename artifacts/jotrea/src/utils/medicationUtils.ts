import type { MedicationData } from "@/types";

/**
 * The medication info shape as returned by the `medications` array in
 * `src/data/medications.ts`. We use a structural type so this file does
 * not need to import from the data layer.
 */
interface MedInfo {
  formulation?: string;
  [key: string]: unknown;
}

/**
 * Returns true when the active medication should be treated as oral (i.e. NOT
 * an injection). A medication is considered an injection when either:
 *  - its catalogue entry carries `formulation: "injection"`, OR
 *  - the stored MedicationData has a custom `injectionSite` (meaning the user
 *    set it up as a custom injection medication).
 *
 * This is the single source of truth for the oral/injection guard. All call
 * sites that decide whether to record an injection site or "oral" must use
 * this function instead of inlining the condition.
 *
 * Implementation note: when medInfo carries an explicit formulation, that
 * value is authoritative and `injectionSite` is ignored. This prevents a
 * stale or inconsistent `injectionSite` value (e.g. after switching a custom
 * medication from "injection" to "other") from being misclassified as
 * injection-mode. For custom medications with no catalogue entry (medInfo is
 * null/undefined), the presence of `injectionSite` remains the sole signal.
 */
export function isOralMedication(
  medication: Pick<MedicationData, "injectionSite">,
  medInfo: MedInfo | null | undefined,
): boolean {
  // Catalogue medications: formulation field is authoritative.
  // Any formulation that is not "injection" (e.g. "pill", "other", etc.)
  // is always treated as oral, even if injectionSite is somehow present.
  if (medInfo?.formulation !== undefined) {
    return medInfo.formulation !== "injection";
  }
  // Custom medications (no catalogue entry): injection only when the user
  // explicitly set an injectionSite.
  return medication.injectionSite === undefined;
}
