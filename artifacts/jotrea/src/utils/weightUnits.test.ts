import { describe, expect, it } from "vitest";
import { canonicalWeights, convertWeight } from "./weightUnits";
import { calculateBMI, calculateBMIFromKg } from "./calculations";

describe("weight unit conversion", () => {
  it("converts 190 lb to about 86.2 kg without changing BMI", () => {
    const kg = convertWeight(190, "lbs", "kg");

    expect(kg).toBe(86.2);
    expect(calculateBMI(190, 66)).toBeCloseTo(
      calculateBMIFromKg(kg, 66 * 2.54),
      1
    );
  });

  it("is stable across an lb to kg to lb round trip", () => {
    expect(convertWeight(convertWeight(190, "lbs", "kg"), "kg", "lbs")).toBe(190);
  });

  it("always supplies canonical lb and kg values from the selected display unit", () => {
    expect(canonicalWeights(86.2, "kg")).toEqual({ lbs: 190, kg: 86.2 });
  });
});