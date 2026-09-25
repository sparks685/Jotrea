import { Button } from "@/components/ui/button";

/** Render while a proposed weigh-in awaits approval. Do not persist until onConfirm. */
export function WeightChangeConfirmation({ onEdit, onConfirm, previousWeight, proposedWeight, unit }: {
  onEdit: () => void; onConfirm: () => void; previousWeight?: number; proposedWeight?: number; unit?: string;
}) {
  return (
    <div role="alertdialog" aria-label="Confirm weight change" className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
      <p className="text-sm font-semibold">
        {previousWeight != null && proposedWeight != null && unit
          ? `Your previous weight was ${previousWeight} ${unit}. You entered ${proposedWeight} ${unit}, a change of 10% or more. Is it correct?`
          : "This weight differs by 10% or more from your previous entry. Is it correct?"}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onEdit}>Edit weight</Button>
        <Button type="button" onClick={onConfirm}>Save anyway</Button>
      </div>
    </div>
  );
}