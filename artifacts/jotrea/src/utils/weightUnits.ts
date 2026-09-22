export const LBS_PER_KG = 2.20462;

export type WeightUnit = "lbs" | "kg";

export function convertWeight(
  weight: number,
  from: WeightUnit,
  to: WeightUnit
): number {
  if (!Number.isFinite(weight) || from === to) return weight;
  const converted = from === "lbs" ? weight / LBS_PER_KG : weight * LBS_PER_KG;
  return Math.round(converted * 10) / 10;
}

export function convertWeightInput(
  value: string,
  from: WeightUnit,
  to: WeightUnit
): string {
  if (!value.trim()) return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return String(convertWeight(parsed, from, to));
}

export function canonicalWeights(weight: number, unit: WeightUnit): {
  lbs: number;
  kg: number;
} {
  const lbs = unit === "lbs" ? weight : weight * LBS_PER_KG;
  const kg = unit === "kg" ? weight : weight / LBS_PER_KG;
  return {
    lbs: Math.round(lbs * 10) / 10,
    kg: Math.round(kg * 10) / 10,
  };
}