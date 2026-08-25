import { useEffect, useMemo, useState } from "react";
import { Check, Crown, Loader2, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useMedication";
import { useSubscription } from "@/hooks/useSubscription";
import { isNativeCapacitor } from "@/utils/capacitor";

const BENEFITS = [
  "Medication Cabinet for multiple prescribed medications",
  "Additional reminder times for each cabinet medication",
  "Apple Health weight sync",
  "Advanced weight and symptom trends",
  "Provider visit summaries",
];

export default function Plus() {
  const { user, setUser } = useUser();
  const { products, status, loading, pending, error, purchase, restore } = useSubscription();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isPlus = isNativeCapacitor() ? status.isPlus : user.subscription === "premium";

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => (a.interval === "year" ? -1 : b.interval === "year" ? 1 : 0)),
    [products]
  );

  useEffect(() => {
    if (!selectedId && sortedProducts.length > 0) {
      setSelectedId(sortedProducts.find((product) => product.interval === "year")?.id ?? sortedProducts[0].id);
    }
  }, [selectedId, sortedProducts]);

  const persistStatus = (next: typeof status) => {
    setUser({
      ...user,
      subscription: next.isPlus ? "premium" : "free",
      subscriptionProductId: next.productId,
      subscriptionExpiresAt: next.expiresAt,
    });
  };

  const handlePurchase = async () => {
    if (!selectedId) return;
    try {
      persistStatus(await purchase(selectedId));
    } catch {
      // The hook exposes a clear, user-visible error.
    }
  };

  const handleRestore = async () => {
    try {
      persistStatus(await restore());
    } catch {
      // The hook exposes a clear, user-visible error.
    }
  };

  return (
    <PageContainer className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/70 px-6 py-7 text-primary-foreground shadow-lg">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-widest">
            <Crown size={13} /> Jotrea Plus
          </div>
          <h1 className="text-2xl font-bold">More organization for your prescribed-information tracking</h1>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/85">
            Keep the essential tracker free. Add expanded organization and provider-ready reporting when you need it.
          </p>
        </div>
      </section>

      {isPlus && (
        <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4" data-testid="status-plus-active">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="text-secondary" size={19} /> Jotrea Plus is active
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {status.state === "trial" ? "Your free trial is active." : "Premium features are unlocked."}
            {(status.expiresAt || user.subscriptionExpiresAt) &&
              ` Access through ${new Date(status.expiresAt ?? user.subscriptionExpiresAt!).toLocaleDateString()}.`}
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-bold text-foreground">Everything in Plus</h2>
        <div className="mt-4 space-y-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit} className="flex gap-3 text-sm text-foreground">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/10">
                <Check size={13} className="text-primary" />
              </span>
              {benefit}
            </div>
          ))}
        </div>
      </div>

      {!isPlus && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-7" data-testid="status-products-loading">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            sortedProducts.map((product) => {
              const selected = selectedId === product.id;
              return (
                <button
                  key={product.id}
                  onClick={() => setSelectedId(product.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selected ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border bg-card"
                  }`}
                  data-testid={`button-product-${product.interval}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{product.displayName}</span>
                        {product.interval === "year" && (
                          <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                            Best value
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {product.trialDays ? `${product.trialDays}-day free trial, then ` : ""}
                        billed {product.interval === "year" ? "annually" : "monthly"}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-foreground" data-testid={`text-price-${product.interval}`}>
                      {product.displayPrice}
                    </span>
                  </div>
                </button>
              );
            })
          )}
          <Button
            className="h-12 w-full rounded-xl gap-2"
            disabled={!selectedId || pending || loading}
            onClick={handlePurchase}
            data-testid="button-start-plus"
          >
            {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Start free trial
          </Button>
          <p className="px-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            Payment is charged to your App Store account. Subscription renews unless canceled at least 24 hours before renewal.
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive" data-testid="status-subscription-error">
          {error}
        </p>
      )}

      <Button
        variant="outline"
        className="w-full rounded-xl gap-2"
        disabled={pending}
        onClick={handleRestore}
        data-testid="button-restore-purchases"
      >
        <RotateCcw size={14} /> Restore Purchases
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Basic medication, weight, symptom and history tracking, one reminder, and CSV export remain free.
      </p>
    </PageContainer>
  );
}