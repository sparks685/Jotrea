import { useEffect, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { BottomNav } from "@/components/BottomNav";
import { useMedication } from "@/hooks/useMedication";
import { initGA, pageView } from "@/lib/analytics";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import DoseLog from "@/pages/DoseLog";
import WeightTracker from "@/pages/WeightTracker";
import MedInfo from "@/pages/MedInfo";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";

class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[PageErrorBoundary]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center gap-4">
          <p className="text-sm font-semibold text-destructive">Something went wrong on this page.</p>
          <p className="text-xs text-muted-foreground font-mono break-all">{this.state.error.message}</p>
          <button
            className="text-xs font-semibold px-4 py-2 rounded-full border border-border hover:bg-muted/40"
            onClick={() => { localStorage.clear(); location.replace("/"); }}
          >
            Reset &amp; Restart
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}




const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };


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

function AppRoutes() {
  const { medication } = useMedication();
  const [location] = useLocation();

  const isOnboarding = location === "/onboarding";

  return (
    <>
      <RouteTracker />
      <div
        className={`flex-1 overflow-y-auto ${isOnboarding ? "" : "pb-20"}`}
        style={!isOnboarding ? { paddingTop: "env(safe-area-inset-top)" } : {}}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className="min-h-full"
          >
            <PageErrorBoundary>
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
                <Route path="/reset"><ResetAndRedirect /></Route>
                <Route component={NotFound} />
              </Switch>
            </PageErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
      {!isOnboarding && medication && <BottomNav />}
    </>
  );
}

function App() {
  useEffect(() => {
    initGA();
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
