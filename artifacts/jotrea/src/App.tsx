import { useEffect } from "react";
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


const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = { duration: 0.2, ease: [0.4, 0, 0.2, 1] as const };

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
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
      <div className={`flex-1 overflow-y-auto ${isOnboarding ? "" : "pb-20"}`}>
        <AnimatePresence mode="wait">
          <Switch key={location}>
            <Route path="/onboarding">
              <AnimatedPage>
                <Onboarding />
              </AnimatedPage>
            </Route>
            <Route path="/">
              {!medication ? (
                <Redirect to="/onboarding" />
              ) : (
                <AnimatedPage>
                  <Dashboard />
                </AnimatedPage>
              )}
            </Route>
            <Route path="/calendar">
              {!medication ? (
                <Redirect to="/onboarding" />
              ) : (
                <AnimatedPage>
                  <DoseLog />
                </AnimatedPage>
              )}
            </Route>
            <Route path="/weight">
              {!medication ? (
                <Redirect to="/onboarding" />
              ) : (
                <AnimatedPage>
                  <WeightTracker />
                </AnimatedPage>
              )}
            </Route>
            <Route path="/med-info">
              {!medication ? (
                <Redirect to="/onboarding" />
              ) : (
                <AnimatedPage>
                  <MedInfo />
                </AnimatedPage>
              )}
            </Route>
            <Route path="/settings">
              {!medication ? (
                <Redirect to="/onboarding" />
              ) : (
                <AnimatedPage>
                  <Settings />
                </AnimatedPage>
              )}
            </Route>
            <Route component={NotFound} />
          </Switch>
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
