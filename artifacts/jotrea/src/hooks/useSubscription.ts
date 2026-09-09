import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@/hooks/useMedication";
import { subscriptionService } from "@/services/subscriptionService";
import { applySubscriptionStatus } from "@/utils/subscriptionState";
import type { SubscriptionProduct, SubscriptionStatus } from "@/types";

const FREE_STATUS: SubscriptionStatus = { state: "free", isPlus: false };

export function useSubscription() {
  const { setUser } = useUser();
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [status, setStatus] = useState<SubscriptionStatus>(FREE_STATUS);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProducts, nextStatus] = await Promise.all([
        subscriptionService.getProducts(),
        subscriptionService.getStatus(),
      ]);
      setProducts(nextProducts);
      setStatus(nextStatus);
      setUserRef.current((current) => applySubscriptionStatus(current, nextStatus));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load subscription details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(async (operation: () => Promise<SubscriptionStatus>) => {
    setPending(true);
    setError(null);
    try {
      const nextStatus = await operation();
      setStatus(nextStatus);
      setUserRef.current((current) => applySubscriptionStatus(current, nextStatus));
      return nextStatus;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The purchase could not be completed.";
      setError(message);
      throw cause;
    } finally {
      setPending(false);
    }
  }, []);

  return {
    products,
    status,
    loading,
    pending,
    error,
    refresh,
    purchase: (productId: string) => run(() => subscriptionService.purchase(productId)),
    restore: () => run(() => subscriptionService.restore()),
  };
}