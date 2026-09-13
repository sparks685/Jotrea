import { useState } from "react";
import { ChevronLeft, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { PageContainer } from "@/components/PageContainer";
import { Button } from "@/components/ui/button";
import { useReviewerAccess } from "@/hooks/useReviewerAccess";

export default function ReviewerAccess() {
  const [, setLocation] = useLocation();
  const { isActive, state, error, activate, clear } = useReviewerAccess();
  const [code, setCode] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await activate(code);
      // Do not retain the submitted code after activation.
      setCode("");
    } catch {
      // The hook exposes an explicit, user-visible message and keeps the form
      // available for a retry.
    }
  };

  return (
    <PageContainer className="space-y-5">
      <button
        type="button"
        className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => setLocation("/settings")}
        aria-label="Back to Settings"
        data-testid="button-back-to-settings"
      >
        <ChevronLeft size={22} aria-hidden="true" />
        Settings
      </button>

      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-primary" aria-hidden="true" />
          <h1 className="text-lg font-bold text-foreground">Reviewer Access</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter the reviewer code provided for Android testing. Access is stored
          only on this installation and does not change your paid subscription.
        </p>

        {isActive ? (
          <div className="mt-5 space-y-3">
            <div
              className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4"
              role="status"
              data-testid="reviewer-access-active"
            >
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <ShieldCheck size={18} className="text-secondary" aria-hidden="true" />
                Reviewer access is active
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Jotrea Plus features are unlocked permanently on this Android installation.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl gap-2"
              onClick={clear}
              data-testid="button-clear-reviewer-access"
            >
              <Trash2 size={14} aria-hidden="true" />
              Clear reviewer access
            </Button>
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={handleSubmit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="reviewer-access-code" className="text-sm font-medium text-foreground">
                Reviewer code
              </label>
              <input
                id="reviewer-access-code"
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-describedby={error ? "reviewer-access-error" : undefined}
                data-testid="input-reviewer-access-code"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl gap-2"
              disabled={state === "activating" || !code.trim()}
              aria-busy={state === "activating"}
              data-testid="button-activate-reviewer-access"
            >
              {state === "activating" && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Activate reviewer access
            </Button>
            {error && (
              <p
                id="reviewer-access-error"
                className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
                role="alert"
                data-testid="reviewer-access-error"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </section>
    </PageContainer>
  );
}