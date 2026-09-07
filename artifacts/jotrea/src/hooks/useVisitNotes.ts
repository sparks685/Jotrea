import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { VisitNote } from "@/types";

export function isValidVisitNote(value: unknown): value is VisitNote {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  const optionalString = (field: string) =>
    note[field] === undefined || typeof note[field] === "string";
  const validQuestions =
    note.questions === undefined ||
    (Array.isArray(note.questions) &&
      note.questions.every((question) => {
        if (typeof question !== "object" || question === null || Array.isArray(question)) return false;
        const item = question as Record<string, unknown>;
        return typeof item.id === "string" && typeof item.text === "string" && typeof item.discussed === "boolean";
      }));
  const validFollowUps =
    note.followUps === undefined ||
    (Array.isArray(note.followUps) &&
      note.followUps.every((followUp) => {
        if (typeof followUp !== "object" || followUp === null || Array.isArray(followUp)) return false;
        const item = followUp as Record<string, unknown>;
        return (
          typeof item.id === "string" &&
          typeof item.text === "string" &&
          typeof item.completed === "boolean" &&
          (item.date === undefined || typeof item.date === "string")
        );
      }));

  return (
    typeof note.id === "string" &&
    note.id.length > 0 &&
    typeof note.visitDate === "string" &&
    typeof note.createdAt === "string" &&
    typeof note.updatedAt === "string" &&
    typeof note.includeInProviderSummary === "boolean" &&
    optionalString("providerName") &&
    optionalString("specialty") &&
    optionalString("visitType") &&
    optionalString("reason") &&
    optionalString("medicationTrackingId") &&
    optionalString("beforeVisit") &&
    optionalString("duringVisit") &&
    optionalString("afterVisit") &&
    (note.tags === undefined || (Array.isArray(note.tags) && note.tags.every((tag) => typeof tag === "string"))) &&
    validQuestions &&
    validFollowUps
  );
}

function safeVisitNotes(value: unknown): VisitNote[] {
  return Array.isArray(value) ? value.filter(isValidVisitNote) : [];
}

export function useVisitNotes() {
  const [storedNotes, setStoredNotes] = useLocalStorage<VisitNote[]>("jotrea_visit_notes", []);
  const notes = safeVisitNotes(storedNotes);
  const setNotes = (value: VisitNote[] | ((current: VisitNote[]) => VisitNote[])) => {
    setStoredNotes((current) => {
      const safeCurrent = safeVisitNotes(current);
      return safeVisitNotes(typeof value === "function" ? value(safeCurrent) : value);
    });
  };
  return { notes, setNotes };
}
