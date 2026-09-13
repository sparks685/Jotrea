import { useCallback, useEffect, useState } from "react";
import { requestReviewerAccess } from "@/services/reviewerAccessService";
import { isAndroidCapacitor } from "@/utils/capacitor";
import {
  clearReviewerAccessGrant,
  isValidReviewerAccessGrant,
  readReviewerAccessGrant,
  REVIEWER_ACCESS_STORAGE_KEY,
  storeReviewerAccessGrant,
} from "@/utils/reviewerAccess";
import type { ReviewerAccessGrant } from "@/types";

export type ReviewerAccessState = "inactive" | "activating" | "active" | "error";

export function useReviewerAccess() {
  const isAndroid = isAndroidCapacitor();
  const [grant, setGrant] = useState<ReviewerAccessGrant | null>(() => readReviewerAccessGrant());
  const [state, setState] = useState<ReviewerAccessState>(() => grant ? "active" : "inactive");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const nextGrant = isAndroid ? readReviewerAccessGrant() : null;
      setGrant(nextGrant);
      setState((current) => current === "activating" ? current : nextGrant ? "active" : "inactive");
      if (nextGrant) setError(null);
    };
    sync();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === REVIEWER_ACCESS_STORAGE_KEY) sync();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [isAndroid]);

  const activate = useCallback(async (code: string) => {
    setState("activating");
    setError(null);
    try {
      const nextGrant = await requestReviewerAccess(code);
      storeReviewerAccessGrant(nextGrant);
      setGrant(nextGrant);
      setState("active");
      return nextGrant;
    } catch (cause) {
      const message = cause instanceof Error
        ? cause.message
        : "Reviewer access could not be activated. Please try again.";
      setError(message);
      setState("error");
      throw cause;
    }
  }, []);

  const clear = useCallback(() => {
    clearReviewerAccessGrant();
    setGrant(null);
    setError(null);
    setState("inactive");
  }, []);

  return {
    grant,
    isActive: isAndroid && isValidReviewerAccessGrant(grant),
    state,
    error,
    activate,
    clear,
  };
}