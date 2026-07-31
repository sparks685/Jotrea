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
 */
export function isOralMedication(
  medication: Pick<MedicationData, "injectionSite">,
  medInfo: MedInfo | null | undefined,
): boolean {
  return medInfo?.formulation !== "injection" && medication.injectionSite === undefined;
}
