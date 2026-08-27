import { useEffect, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BottomNav } from "@/components/BottomNav";
import { useMedication, useOralDoseMigration, useUser } from "@/hooks/useMedication";
import { initGA, pageView } from "@/lib/analytics";
import { subscriptionService } from "@/services/subscriptionService";
import { isNativeCapacitor } from "@/utils/capacitor";
import { registerNotificationSW } from "@/utils/notifications";
import {
  applySubscriptionStatus,
  removeExpiredCachedPlus,
} from "@/utils/subscriptionState";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import DoseLog from "@/pages/DoseLog";
import WeightTracker from "@/pages/WeightTracker";
import MedInfo from "@/pages/MedInfo";
import Settings from "@/pages/Settings";
import Sources from "@/pages/Sources";
import Plus from "@/pages/Plus";
import MedicationCabinet from "@/pages/MedicationCabinet";
import AdvancedTrends from "@/pages/AdvancedTrends";
import VisitSummary from "@/pages/VisitSummary";
import NotFound from "@/pages/not-found";

export class PageErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; confirmingWipe: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, confirmingWipe: false };
  }
  static getDerivedStateFromError(error: Error) { return { error, confirmingWipe: false }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[PageErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      if (this.state.confirmingWipe) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[300px] px-6 py-16 text-center gap-4">
            <p className="text-sm font-semibold text-destructive">Wipe all data?</p>
            <p className="text-xs text-muted-foreground">
              This will permanently delete all your medication, dose, and weight records. This cannot be undone.
            </p>
            <button
              className="text-xs font-semibold px-4 py-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { localStorage.clear(); location.replace("/"); }}
            >
              Yes, wipe everything
            </button>
            <button
              className="text-xs text-muted-foreground underline"
              onClick={() => this.setState({ confirmingWipe: false })}
            >
              Cancel
            </button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] px-6 py-16 text-center gap-4">
          <p className="text-sm font-semibold text-destructive">Something went wrong on this page.</p>
          <p className="text-xs text-muted-foreground">
            This is likely a temporary glitch. Try reloading — your data should still be safe.
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all opacity-60">{this.state.error.message}</p>
          <button
            className="text-xs font-semibold px-4 py-2 rounded-full border border-border hover:bg-muted/40"
            onClick={() => location.reload()}
          >
            Reload page
          </button>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => this.setState({ confirmingWipe: true })}
          >
            My data may be corrupted — wipe &amp; restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}




function ResetAndRedirect() {
  const [, setLoc] = useLocation();
  useEffect(() => {
    localStorage.clear();
    setLoc("/onboarding", { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function RouteTracker() {
  const [location] = useLocation();
  useEffect(() => {
    pageView(location);
  }, [location]);
  return null;
}

export function NativeSubscriptionSync() {
  const { setUser } = useUser();
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  useEffect(() => {
    if (!isNativeCapacitor()) return;
    let active = true;
    let syncInFlight: Promise<void> | null = null;

    const syncSubscription = () => {
      if (syncInFlight) return syncInFlight;
      // Never leave an already-expired cached entitlement unlocked while a
      // network or StoreKit refresh is pending or unavailable.
      setUserRef.current((current) => removeExpiredCachedPlus(current));
      syncInFlight = subscriptionService.getStatus()
        .then((status) => {
          if (!active) return;
          setUserRef.current((current) => applySubscriptionStatus(current, status));
        })
        .catch((error) => {
          if (!active) return;
          setUserRef.current((current) => removeExpiredCachedPlus(current));
          console.warn("Unable to refresh Jotrea Plus status", error);
        })
        .finally(() => {
          syncInFlight = null;
        });
      return syncInFlight;
    };

    void syncSubscription();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncSubscription();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}

function AppRoutes() {
  const { medication } = useMedication();
  const [location] = useLocation();
  useOralDoseMigration();

  const isOnboarding = location === "/onboarding";

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Don't let the browser restore the previous scroll position on refresh.
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    // The document itself can also be the scroller (root uses min-height),
    // so reset the window scroll as well.
    window.scrollTo(0, 0);
  }, [location]);

  return (
    <>
      <RouteTracker />
      <NativeSubscriptionSync />
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={!isOnboarding ? { paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" } : {}}
      >
        <div
          key={location}
          className="page-enter min-h-full w-full"
          style={!isOnboarding ? { paddingTop: "env(safe-area-inset-top)" } : {}}
        >
          <PageErrorBoundary key={location}>
              <Switch>
                <Route path="/onboarding"><Onboarding /></Route>
                <Route path="/">
                  {!medication ? <Redirect to="/onboarding" /> : <Dashboard />}
                </Route>
                <Route path="/calendar">
                  {!medication ? <Redirect to="/onboarding" /> : <DoseLog />}
                </Route>
                <Route path="/weight">
                  {!medication ? <Redirect to="/onboarding" /> : <WeightTracker />}
                </Route>
                <Route path="/med-info">
                  {!medication ? <Redirect to="/onboarding" /> : <MedInfo />}
                </Route>
                <Route path="/settings">
                  {!medication ? <Redirect to="/onboarding" /> : <Settings />}
                </Route>
                <Route path="/plus">
                  {!medication ? <Redirect to="/onboarding" /> : <Plus />}
                </Route>
                <Route path="/medication-cabinet">
                  {!medication ? <Redirect to="/onboarding" /> : <MedicationCabinet />}
                </Route>
                <Route path="/advanced-trends">
                  {!medication ? <Redirect to="/onboarding" /> : <AdvancedTrends />}
                </Route>
                <Route path="/visit-summary">
                  {!medication ? <Redirect to="/onboarding" /> : <VisitSummary />}
                </Route>
                <Route path="/sources"><Sources /></Route>
                <Route path="/reset"><ResetAndRedirect /></Route>
                <Route component={NotFound} />
              </Switch>
            </PageErrorBoundary>
          </div>
      </div>
      {!isOnboarding && medication && <BottomNav />}
    </>
  );
}

function App() {
  useEffect(() => {
    initGA();
    registerNotificationSW();
  }, []);

  return (
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <div className="max-w-md mx-auto min-h-[100dvh] bg-background shadow-2xl relative flex flex-col overflow-hidden">
          <AppRoutes />
        </div>
      </WouterRouter>
      <Toaster />
      <SpeedInsights />
    </TooltipProvider>
  );
}

export default App;
