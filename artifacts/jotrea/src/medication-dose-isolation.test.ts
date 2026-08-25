import { describe, expect, it } from "vitest";
import { getNextDoseDate } from "@/utils/dates";
import {
  dosesForMedication,
  getMedicationTrackingId,
  legacyOwnerForFirstCabinetActivation,
} from "@/utils/medicationDoses";
import type { DoseEntry, MedicationData } from "@/types";

const original: MedicationData = {
  id: "med-a",
  brandName: "Medication A",
  genericName: "medication-a",
  dose: 1,
  frequency: "daily",
  startDate: "2020-01-01",
  active: true,
};

const cabinetMedication: MedicationData = {
  ...original,
  id: "med-b",
  brandName: "Medication B",
  cabinetId: "cabinet-med-b",
};

const doses: DoseEntry[] = [
  { id: "legacy", date: "2020-01-01", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
  { id: "a-new", medicationId: "med-a", date: "2026-01-01", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
  { id: "b-new", medicationId: "cabinet-med-b", date: "2026-01-01", time: "09:00", doseAmount: 1, site: "oral", notes: "", taken: true },
];

describe("medication-specific dose isolation", () => {
  it("keeps legacy single-medication entries visible only for their recorded original tracker", () => {
    expect(dosesForMedication(doses, original, "med-a").map((dose) => dose.id)).toEqual(["legacy", "a-new"]);
    expect(dosesForMedication(doses, cabinetMedication, "med-a").map((dose) => dose.id)).toEqual(["b-new"]);
  });

  it("uses Cabinet identity rather than a shared catalog medication id", () => {
    const anotherCabinetEntry = { ...cabinetMedication, cabinetId: "cabinet-med-b-second" };
    expect(getMedicationTrackingId(cabinetMedication)).toBe("cabinet-med-b");
    expect(dosesForMedication(doses, anotherCabinetEntry, "med-a")).toEqual([]);
  });

  it("passes only active-medication doses into dose scheduling calculations", () => {
    const today = new Date().toISOString().slice(0, 10);
    const active = { ...cabinetMedication, startDate: today, frequency: "daily" as const };
    const otherMedicationDose = [{ ...doses[2], date: today, medicationId: "med-a" }];
    const activeMedicationDose = [{ ...doses[2], date: today, medicationId: getMedicationTrackingId(active) }];

    expect(getNextDoseDate(today, "daily", dosesForMedication(otherMedicationDose, active, "med-a")).toISOString().slice(0, 10))
      .toBe(today);
    expect(getNextDoseDate(today, "daily", dosesForMedication(activeMedicationDose, active, "med-a")).toISOString().slice(0, 10))
      .not.toBe(today);
  });

  it("keeps untagged history and a daily reminder schedule continuous when the original tracker first enters Cabinet", () => {
    const today = new Date().toISOString().slice(0, 10);
    const originalTracker: MedicationData = { ...original, startDate: today };
    const firstCabinetEntry: MedicationData = {
      ...originalTracker,
      cabinetId: "cabinet-original",
    };
    const historicalDoses: DoseEntry[] = [{
      id: "before-cabinet",
      date: today,
      time: "09:00",
      doseAmount: 1,
      site: "oral",
      notes: "",
      taken: true,
    }];

    // This is the state transition performed by "Add current medication to cabinet".
    const legacyDoseMedicationId = legacyOwnerForFirstCabinetActivation(firstCabinetEntry);
    const activeDoses = dosesForMedication(historicalDoses, firstCabinetEntry, legacyDoseMedicationId);

    expect(activeDoses).toEqual(historicalDoses);
    expect(getNextDoseDate(today, "daily", activeDoses).toISOString().slice(0, 10)).not.toBe(today);
  });
});