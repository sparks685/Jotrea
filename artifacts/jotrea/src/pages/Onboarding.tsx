import { useState, useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Search, Syringe, Pill, Check, Info, Bell, Droplets, Target, Activity, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { medications } from "@/data/medications";
import { useMedication, useDoses, useWeights, useUser } from "@/hooks/useMedication";
import { format, subDays, subWeeks, addDays, addWeeks } from "date-fns";
import { calculateBMI, calculateBMIFromKg } from "@/utils/calculations";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];

const haptic = (pattern: number | number[] = 10) => {
  if ("vibrate" in navigator) navigator.vibrate(pattern);
};

function seedDemoData(
  medId: string,
  frequency: string,
  dose: number,
  setDoses: (v: any) => void,
  setWeights: (v: any) => void
) {
  const today = new Date();
  const demoWeights = Array.from({ length: 5 }, (_, i) => ({
    id: `w${i}`,
    date: format(subDays(today, (4 - i) * 7), "yyyy-MM-dd"),
    weight: 215 - i * 2.3,
  }));

  const demoDoses = [];
  if (frequency === "weekly") {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({
        id: `d${i}`,
        date: format(subWeeks(today, i), "yyyy-MM-dd"),
        time: "09:00",
        doseAmount: dose,
        site: INJECTION_SITES[i % 4],
        notes: "",
        taken: true,
      });
    }
  } else {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({
        id: `d${i}`,
        date: format(subDays(today, i), "yyyy-MM-dd"),
        time: "08:00",
        doseAmount: dose,
        site: INJECTION_SITES[0],
        notes: "",
        taken: true,
      });
    }
  }

  setDoses(demoDoses);
  setWeights(demoWeights);
}

const BODY_SVG = (
  <svg viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full opacity-80">
    <path d="M40 20 C40 10 60 10 60 20 C60 30 55 35 50 35 C45 35 40 30 40 20 Z" fill="hsl(var(--muted))" />
    <path d="M35 40 Q50 35 65 40 L85 80 L75 85 L60 55 L60 100 L65 190 L55 190 L50 110 L45 190 L35 190 L40 100 L40 55 L25 85 L15 80 Z" fill="hsl(var(--muted))" />
  </svg>
);

const stepVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 40 : -40, opacity: 0 }),
};

const transitionEase = [0.4, 0, 0.2, 1] as const;

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  
  // State
  const [gender, setGender] = useState<string>("");
  const [bMonth, setBMonth] = useState("1");
  const [bDay, setBDay] = useState("1");
  const [bYear, setBYear] = useState("1990");
  
  const [heightUnit, setHeightUnit] = useState<"imperial" | "metric">("imperial");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("6");
  const [heightCm, setHeightCm] = useState("165");
  const [currentWeight, setCurrentWeight] = useState("190");
  
  const [startWeight, setStartWeight] = useState("");
  const [startDateGlp, setStartDateGlp] = useState(format(new Date(), "yyyy-MM-dd"));
  
  const [goalWeight, setGoalWeight] = useState("150");
  const [goalPace, setGoalPace] = useState(1.0);
  
  const [activity, setActivity] = useState("");
  const [motivations, setMotivations] = useState<string[]>([]);
  const [sideEffects, setSideEffects] = useState<string[]>([]);
  
  const [search, setSearch] = useState("");
  const [selectedMed, setSelectedMed] = useState<any>(null);
  const [selectedDose, setSelectedDose] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [injectionSite, setInjectionSite] = useState(INJECTION_SITES[0]);
  const [reminderEnabled, setReminderEnabled] = useState(true);

  const { setMedication } = useMedication();
  const { setDoses } = useDoses();
  const { setWeights } = useWeights();
  const { user, setUser } = useUser();

  const handleNext = (nextStep: number) => {
    haptic();
    setDirection(1);
    setStep(nextStep);
  };

  const handleBack = () => {
    haptic();
    setDirection(-1);
    if (step === 10) setStep(9);
    else setStep(step - 1);
  };

  const grouped = medications.reduce<Record<string, typeof medications>>((acc, med) => {
    if (!acc[med.genericName]) acc[med.genericName] = [];
    acc[med.genericName].push(med);
    return acc;
  }, {});

  const filteredGrouped = Object.entries(grouped).reduce<Record<string, typeof medications>>(
    (acc, [generic, meds]) => {
      const filtered = meds.filter(
        (m) =>
          m.genericName.toLowerCase().includes(search.toLowerCase()) ||
          m.brandNames.some((b) => b.toLowerCase().includes(search.toLowerCase()))
      );
      if (filtered.length) acc[generic] = filtered;
      return acc;
    },
    {}
  );

  const handleComplete = () => {
    if (!selectedMed || !selectedDose) return;
    const medData = {
      id: selectedMed.id,
      genericName: selectedMed.genericName,
      brandName: selectedMed.brandNames[0],
      dose: selectedDose,
      frequency: selectedMed.frequency,
      startDate,
      injectionSite: selectedMed.formulation === "injection" ? injectionSite : undefined,
      active: true,
    };
    setMedication(medData);
    
    const cw = parseFloat(currentWeight);
    const sw = parseFloat(startWeight) || cw;
    const gw = parseFloat(goalWeight);
    
    setUser({
      name: user.name || "User",
      gender: gender as any,
      birthday: `${bYear}-${bMonth.padStart(2, "0")}-${bDay.padStart(2, "0")}`,
      heightUnit,
      heightFt: parseInt(heightFt),
      heightIn: parseInt(heightIn),
      heightCm: parseInt(heightCm),
      currentWeightLbs: heightUnit === "imperial" ? cw : undefined,
      currentWeightKg: heightUnit === "metric" ? cw : undefined,
      startingWeightLbs: heightUnit === "imperial" ? sw : undefined,
      startingWeightKg: heightUnit === "metric" ? sw : undefined,
      glpStartDate: startDateGlp,
      goalWeightLbs: heightUnit === "imperial" ? gw : undefined,
      goalWeightKg: heightUnit === "metric" ? gw : undefined,
      goalPaceLbs: goalPace,
      activityLevel: activity as any,
      motivations,
      troublesomeSideEffects: sideEffects,
      units: heightUnit === "imperial" ? "lbs" : "kg",
      subscription: "free",
    });
    
    seedDemoData(selectedMed.id, selectedMed.frequency, selectedDose, setDoses, setWeights);
    trackEvent("onboarding_complete", { medication: selectedMed.genericName });
  };
  
  // Custom scroll sync for ruler
  const rulerRef = useRef<HTMLDivElement>(null);
  
  // Set initial ruler scroll position only when entering step 5 or changing units.
  // goalWeight is intentionally NOT a dep — the onScroll handler owns goalWeight updates
  // and re-running this effect on every goalWeight change creates a runaway feedback loop.
  useEffect(() => {
    if (step === 5) {
      const minW = heightUnit === "imperial" ? 80 : 30;
      const index = parseInt(goalWeight) - minW;
      // Each tick is 40px wide; the left spacer is calc(50% - 20px) so
      // the center of tick `index` lands at scrollLeft = index * 40.
      requestAnimationFrame(() => {
        if (rulerRef.current) {
          rulerRef.current.scrollLeft = index * 40;
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, heightUnit]);

  const rulerNumbers = [];
  const rMin = heightUnit === "imperial" ? 80 : 30;
  const rMax = heightUnit === "imperial" ? 400 : 200;
  for(let i=rMin; i<=rMax; i++) rulerNumbers.push(i);

  const [loadingTicks, setLoadingTicks] = useState(0);
  useEffect(() => {
    if (step === 12) {
      const timer1 = setTimeout(() => { setLoadingTicks(1); haptic(); }, 600);
      const timer2 = setTimeout(() => { setLoadingTicks(2); haptic(); }, 1200);
      const timer3 = setTimeout(() => { setLoadingTicks(3); haptic(); }, 1800);
      const timer4 = setTimeout(() => {
        handleComplete();
        haptic([10, 30, 10]);
        setStep(13);
      }, 2500);
      return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); clearTimeout(timer4); };
    }
    return undefined;
  }, [step]);

  return (
    <div
      className="min-h-[100dvh] bg-background flex flex-col overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Progress bar — always in layout flow (4px height) */}
      <div className="flex-shrink-0 h-1 bg-muted">
        {step > 0 && step <= 14 && (
          <div
            className="h-full bg-[#D4A574] transition-all duration-300 ease-out"
            style={{ width: `${(step / 14) * 100}%` }}
          />
        )}
      </div>


      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {step === 0 && (
          <motion.div
            key="s0"
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-8"
          >
            <div className="space-y-2">
              <div className="w-24 h-24 rounded-3xl bg-[#D4A574] flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Syringe size={42} className="text-white" />
              </div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight">Jotrea</h1>
              <p className="text-base text-muted-foreground font-medium">
                Your GLP-1 Journey, Simplified
              </p>
            </div>

            <div className="space-y-4 w-full max-w-xs text-left bg-card p-6 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-border">
              {[
                "Track doses effortlessly",
                "Monitor your weight progress",
                "Stay on schedule",
                "Pharmacist-curated guidance.",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#D4A574] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>

            <div className="w-full max-w-xs">
              <Button
                className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white hover:opacity-90"
                style={{ backgroundColor: '#D4A574' }}
                onClick={() => handleNext(1)}
              >
                Start Your Journey
              </Button>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="s1" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Gender</h2>
            <p className="text-muted-foreground mb-8">Help us get the basics right.</p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "female", label: "Female", icon: "♀" },
                { id: "male", label: "Male", icon: "♂" },
                { id: "other", label: "Other", icon: "👤" },
                { id: "prefer_not_to_say", label: "Prefer not to say", icon: "∅" }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setGender(opt.id); haptic(); }}
                  className={`h-[120px] flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all shadow-sm ${
                    gender === opt.id ? "bg-[#D4A574] border-[#D4A574] text-white" : "bg-card border-border text-foreground"
                  }`}
                >
                  <span className="text-3xl mb-2">{opt.icon}</span>
                  <span className="font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
            
            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A574' }}
              disabled={!gender}
              onClick={() => handleNext(2)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="s2" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Birthday</h2>
            <p className="text-muted-foreground mb-6">When's your birthday?</p>
            
            <div className="flex gap-2 justify-center bg-card p-6 rounded-3xl border border-border shadow-[0_4px_12px_rgba(0,0,0,0.05)]">
              <select value={bMonth} onChange={e => {setBMonth(e.target.value); haptic();}} className="bg-transparent text-2xl font-bold text-center appearance-none outline-none flex-1">
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i, 1).toLocaleString('default', { month: 'short' })}</option>)}
              </select>
              <span className="text-2xl text-muted-foreground">/</span>
              <select value={bDay} onChange={e => {setBDay(e.target.value); haptic();}} className="bg-transparent text-2xl font-bold text-center appearance-none outline-none flex-1">
                {Array.from({length: 31}, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
              </select>
              <span className="text-2xl text-muted-foreground">/</span>
              <select value={bYear} onChange={e => {setBYear(e.target.value); haptic();}} className="bg-transparent text-2xl font-bold text-center appearance-none outline-none flex-1">
                {Array.from({length: 100}, (_, i) => <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>)}
              </select>
            </div>
            
            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => handleNext(3)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="s3" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Height & Weight</h2>
            <p className="text-muted-foreground mb-8">Your Height & Weight.</p>
            
            <div className="flex bg-muted p-1 rounded-xl w-fit mx-auto mb-8">
              <button 
                onClick={() => {setHeightUnit("imperial"); haptic();}}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${heightUnit === "imperial" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              >
                Imperial
              </button>
              <button 
                onClick={() => {setHeightUnit("metric"); haptic();}}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${heightUnit === "metric" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}
              >
                Metric
              </button>
            </div>
            
            <div className="flex gap-4 items-end justify-center mb-8">
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Height</span>
                {heightUnit === "imperial" ? (
                  <div className="flex gap-2 bg-card p-4 rounded-3xl border border-border shadow-sm w-full justify-center">
                    <select value={heightFt} onChange={e=>{setHeightFt(e.target.value); haptic();}} className="bg-transparent text-xl font-bold outline-none appearance-none text-center">
                      {[3,4,5,6,7].map(v => <option key={v} value={v}>{v} ft</option>)}
                    </select>
                    <select value={heightIn} onChange={e=>{setHeightIn(e.target.value); haptic();}} className="bg-transparent text-xl font-bold outline-none appearance-none text-center">
                      {Array.from({length:12},(_,i)=><option key={i} value={i}>{i} in</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="bg-card p-4 rounded-3xl border border-border shadow-sm w-full text-center">
                    <select value={heightCm} onChange={e=>{setHeightCm(e.target.value); haptic();}} className="bg-transparent text-xl font-bold outline-none appearance-none">
                      {Array.from({length:100},(_,i)=><option key={i+130} value={i+130}>{i+130} cm</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase">Weight</span>
                <div className="bg-card p-4 rounded-3xl border border-border shadow-sm w-full text-center">
                  <select value={currentWeight} onChange={e=>{setCurrentWeight(e.target.value); haptic();}} className="bg-transparent text-xl font-bold outline-none appearance-none text-center">
                    {heightUnit === "imperial" 
                      ? Array.from({length:301},(_,i)=><option key={i+100} value={i+100}>{i+100} lbs</option>)
                      : Array.from({length:161},(_,i)=><option key={i+40} value={i+40}>{i+40} kg</option>)
                    }
                  </select>
                </div>
              </div>
            </div>
            
            {(() => {
              const bmi = heightUnit === "imperial" 
                ? calculateBMI(parseFloat(currentWeight), parseInt(heightFt)*12 + parseInt(heightIn))
                : calculateBMIFromKg(parseFloat(currentWeight), parseInt(heightCm));
              
              let status = "Healthy";
              if(bmi < 18.5) status = "Underweight";
              else if(bmi >= 25 && bmi < 30) status = "Overweight";
              else if(bmi >= 30) status = "Obese";
                
              return (
                <div className="mx-auto bg-[#D4A574]/10 text-[#D4A574] px-4 py-2 rounded-full font-semibold text-sm">
                  BMI: {bmi.toFixed(1)} — {status}
                </div>
              );
            })()}

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => {
                if(!startWeight) setStartWeight(currentWeight);
                if(!goalWeight) setGoalWeight((parseFloat(currentWeight) * 0.8).toFixed(0));
                handleNext(4);
              }}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div
            key="s4" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Start Weight & Date</h2>
            <p className="text-muted-foreground mb-8">Tell us where you started. This helps us calculate your total progress.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Starting Weight ({heightUnit === "imperial" ? "lbs" : "kg"})</label>
                <Input 
                  type="number" 
                  value={startWeight} 
                  onChange={e => setStartWeight(e.target.value)} 
                  className="h-14 rounded-2xl text-lg px-4 bg-card shadow-sm border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">GLP-1 Start Date</label>
                <Input 
                  type="date" 
                  value={startDateGlp} 
                  onChange={e => setStartDateGlp(e.target.value)} 
                  className="h-14 rounded-2xl text-lg px-4 bg-card shadow-sm border-border"
                />
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A574' }}
              disabled={!startWeight}
              onClick={() => handleNext(5)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div
            key="s5" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Goal Weight</h2>
            <p className="text-muted-foreground mb-8">Set your goal weight.</p>

            {/* Dream weight display */}
            <div className="text-center mb-10">
              <span style={{ fontSize: '15px', fontWeight: 600, color: '#D4A574', letterSpacing: '0.1em' }}>Dream weight</span>
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-6xl font-black text-foreground tracking-tight">{goalWeight}</span>
                <span className="text-xl text-muted-foreground font-normal">{heightUnit === "imperial" ? "lbs" : "kg"}</span>
              </div>
            </div>

            {/*
              Premium ruler — strictly fixed layout so scrolling never causes reflow.
              Total height = 56px tick zone + 6px gap + 22px label zone = 84px.
              Tick heights are FIXED (not distance-based):
                center (active) = 52px, 5-lb marks = 20px, 1-lb marks = 10px.
              Only color changes on scroll — no height transitions, no layout shift.
            */}
            <div
              className="relative w-full"
              style={{
                height: '84px',
                overflow: 'hidden',
                WebkitMaskImage: 'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
                maskImage: 'linear-gradient(to right, transparent, black 14%, black 86%, transparent)',
              }}
            >
              {/* Center needle — spans tick zone only (top 56px), elevated with glow + shadow */}
              <div
                className="absolute left-1/2 -translate-x-1/2 z-10 pointer-events-none"
                style={{
                  top: 0,
                  height: '56px',
                  width: '3px',
                  borderRadius: '9999px',
                  background: 'linear-gradient(to bottom, rgba(212,165,116,0.05) 0%, #D4A574 18%, #D4A574 82%, rgba(212,165,116,0.1) 100%)',
                  boxShadow: '0 0 0 1.5px rgba(212,165,116,0.18), 0 0 10px rgba(212,165,116,0.55), 0 2px 8px rgba(212,165,116,0.35)',
                }}
              />

              <div
                ref={rulerRef}
                className="w-full h-full overflow-x-auto snap-x snap-mandatory"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const index = Math.round(el.scrollLeft / 40);
                  let val = rMin + index;
                  if (val < rMin) val = rMin;
                  if (val > rMax) val = rMax;
                  if (val.toString() !== goalWeight) {
                    setGoalWeight(val.toString());
                    haptic(5);
                  }
                }}
              >
                <style>{`.ruler-scroll::-webkit-scrollbar{display:none}`}</style>
                <div className="ruler-scroll h-full flex" style={{ width: 'max-content' }}>
                  <div style={{ width: 'calc(50vw - 20px)', flexShrink: 0 }} />
                  {rulerNumbers.map(n => {
                    const activeLb = parseInt(goalWeight);
                    const dist = Math.abs(n - activeLb);
                    const is5 = n % 5 === 0;
                    const isActive = dist === 0;

                    // Fixed tick heights — never change on scroll
                    const tickH = isActive ? 52 : is5 ? 20 : 10;
                    const tickW = isActive ? '3px' : is5 ? '2px' : '1.5px';

                    // Only color/opacity changes on scroll (no layout impact)
                    const alpha = isActive ? 1 : Math.max(0.32, 0.78 - dist * 0.06);
                    const bgColor = isActive
                      ? 'rgba(212,165,116,1)'
                      : `rgba(156,163,175,${alpha})`;

                    return (
                      <div
                        key={n}
                        className="snap-center flex-shrink-0"
                        style={{ width: '40px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}
                      >
                        {/* Tick zone: fixed 56px, ticks bottom-aligned */}
                        <div style={{ width: '40px', height: '56px', flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                          <div style={{
                            width: tickW,
                            height: `${tickH}px`,
                            backgroundColor: bgColor,
                            borderRadius: '9999px',
                            transition: 'background-color 0.1s ease',
                            boxShadow: isActive ? '0 0 8px rgba(212,165,116,0.5)' : 'none',
                          }} />
                        </div>
                        {/* Gap: fixed 6px */}
                        <div style={{ height: '6px', flexShrink: 0 }} />
                        {/* Label zone: fixed 22px, number centered in the 40px slot */}
                        <div style={{ width: '40px', height: '22px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                          {is5 && (
                            <span style={{
                              display: 'block',
                              width: '40px',
                              textAlign: 'center',
                              fontSize: '12px',
                              fontWeight: isActive ? 600 : 400,
                              color: isActive
                                ? 'hsl(var(--foreground))'
                                : `rgba(156,163,175,${Math.max(0.45, 0.82 - dist * 0.055)})`,
                              userSelect: 'none',
                              lineHeight: 1,
                            }}>{n}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ width: 'calc(50vw - 20px)', flexShrink: 0 }} />
                </div>
              </div>
            </div>

            {/* Motivational badge */}
            {(() => {
              const diff = parseFloat(currentWeight) - parseFloat(goalWeight);
              let weeks = diff / goalPace;
              if (weeks < 0) weeks = 0;
              const d = addWeeks(new Date(), weeks);
              return (
                <div className="text-center mt-10 px-4">
                  <div className="inline-flex items-center gap-2 bg-[#D4A574]/10 text-[#D4A574] px-4 py-2 rounded-full text-sm font-medium">
                    <Target size={16} />
                    At this pace, you'll reach this by {format(d, "MMMM yyyy")}
                  </div>
                </div>
              );
            })()}

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => handleNext(6)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 6 && (
          <motion.div
            key="s6" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Goal Pace</h2>
            <p className="text-muted-foreground mb-6">How quickly do you want to reach your goal?</p>
            
            <div className="space-y-10">
              <div className="text-center">
                <span className="text-5xl font-black">{goalPace.toFixed(1)}</span>
                <span className="text-xl text-muted-foreground font-semibold ml-2">{heightUnit==="imperial"?"lbs":"kg"} / week</span>
              </div>
              
              <div className="px-4">
                <input 
                  type="range" 
                  min="0.5" max="2.5" step="0.5" 
                  value={goalPace} 
                  onChange={e => {setGoalPace(parseFloat(e.target.value)); haptic();}} 
                  className="w-full accent-[#D4A574]"
                />
                <div className="flex justify-between mt-4 text-2xl">
                  <span>🚶</span>
                  <span>🚗</span>
                  <span>🚀</span>
                </div>
              </div>

              {(() => {
                const diff = parseFloat(currentWeight) - parseFloat(goalWeight);
                let weeks = diff / goalPace;
                if(weeks < 0) weeks = 0;
                const d = addWeeks(new Date(), weeks);
                return (
                  <div className="text-center mt-8 px-4">
                    <div className="inline-flex items-center gap-2 bg-[#D4A574] text-white px-4 py-2 rounded-full text-sm font-semibold shadow-sm">
                      Est. Goal Date: {format(d, "MMMM yyyy")}
                    </div>
                  </div>
                );
              })()}
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => handleNext(7)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 7 && (
          <motion.div
            key="s7" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Activity Level</h2>
            <p className="text-muted-foreground mb-8">Tell us about your daily routine.</p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "sedentary", label: "Sedentary", desc: "Mostly desk work or resting", icon: "💺" },
                { id: "lightly_active", label: "Lightly Active", desc: "Light walks, casual movement", icon: "🚶" },
                { id: "active", label: "Active", desc: "Regular exercise, active job", icon: "🏃" },
                { id: "very_active", label: "Very Active", desc: "Daily intense training", icon: "⚡" },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setActivity(opt.id); haptic(); }}
                  className={`h-[130px] flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all shadow-sm text-center ${
                    activity === opt.id ? "bg-[#D4A574]/10 border-[#D4A574]" : "bg-card border-border"
                  }`}
                >
                  <span className="text-4xl mb-3">{opt.icon}</span>
                  <span className="font-bold text-sm mb-1 text-foreground">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.desc}</span>
                </button>
              ))}
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A574' }}
              disabled={!activity}
              onClick={() => handleNext(8)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 8 && (
          <motion.div
            key="s8" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Motivation</h2>
            <p className="text-muted-foreground mb-6">What's driving you to reach your goal?</p>
            
            <div className="grid grid-cols-2 gap-3 content-start">
              {[
                "I want to feel more confident",
                "I'm ready for a fresh start",
                "I want to boost energy",
                "To improve my health / manage PCOS",
                "I want to show up for loved ones",
                "I have a special event coming up",
                "To feel good in my clothes again",
                "Other"
              ].map(opt => {
                const isSelected = motivations.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      haptic();
                      setMotivations(prev => isSelected ? prev.filter(m => m !== opt) : [...prev, opt]);
                    }}
                    className={`relative flex items-center justify-center p-4 rounded-2xl border-2 transition-all text-sm font-semibold text-center min-h-[80px] shadow-sm ${
                      isSelected ? "border-[#D4A574] bg-[#D4A574]/5" : "border-border bg-card"
                    }`}
                  >
                    {isSelected && <div className="absolute -top-2 -right-2 bg-[#D4A574] rounded-full p-0.5"><Check size={12} className="text-white" /></div>}
                    <span className={isSelected ? "text-foreground" : "text-muted-foreground"}>{opt}</span>
                  </button>
                )
              })}
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A574' }}
              disabled={motivations.length === 0}
              onClick={() => handleNext(9)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 9 && (
          <motion.div
            key="s9" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Side Effects</h2>
            <p className="text-muted-foreground mb-8">What side effects are giving you the most trouble?</p>
            
            <div className="flex flex-wrap gap-3 mb-8">
              {["Nausea", "Fatigue", "Hair Loss", "Constipation", "Bloating", "Sulfur Burps", "Heartburn", "Food Noise"].map(opt => {
                const isSelected = sideEffects.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      haptic();
                      setSideEffects(prev => isSelected ? prev.filter(m => m !== opt) : [...prev, opt]);
                    }}
                    className={`px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all ${
                      isSelected ? "border-[#D4A574] bg-[#D4A574] text-white" : "border-border bg-card text-foreground"
                    }`}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            
            <AnimatePresence>
              {sideEffects.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-900"
                >
                  <Info className="flex-shrink-0 mt-0.5 text-amber-600" size={18} />
                  <p className="text-sm font-medium leading-relaxed">Our pharmacy team will provide personalized tips for managing your selected side effects.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => handleNext(10)}
            >
              Continue
            </Button>
          </motion.div>
        )}

        {step === 10 && (
          <motion.div
            key="s10" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col"
          >
            <div className="px-6 pt-2 pb-4 space-y-1">
              <div className="mb-5">
                <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                  <ChevronLeft size={20} className="text-foreground" />
                </button>
              </div>
              <h2 className="text-3xl font-bold text-foreground">Select Medication</h2>
            </div>
            <div className="px-6 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search medications..."
                  className="pl-9 rounded-xl h-12"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
              {Object.entries(filteredGrouped).map(([generic, meds]) => (
                <div key={generic}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{generic}</p>
                  <div className="space-y-2">
                    {meds.map((med) => {
                      const isSelected = selectedMed?.id === med.id;
                      return (
                        <button
                          key={med.id}
                          className={`w-full text-left rounded-2xl p-4 border-2 transition-all duration-200 ${
                            isSelected ? "border-[#D4A574] bg-[#D4A574]/5" : "border-border bg-card shadow-sm"
                          }`}
                          onClick={() => { setSelectedMed(med); haptic(); handleNext(11); }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-foreground text-base">{med.brandNames.join(", ")}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">{generic}</p>
                            </div>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                              med.formulation === "injection" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"
                            }`}>
                              {med.formulation === "injection" ? <Syringe size={10} /> : <Pill size={10} />}
                              {med.formulation}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 11 && selectedMed && (
          <motion.div
            key="s11" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center overflow-y-auto"
          >
            <div className="mb-5">
              <button onClick={handleBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-colors active:scale-95">
                <ChevronLeft size={20} className="text-foreground" />
              </button>
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-1">Set Your Dose</h2>
            <p className="text-muted-foreground mb-8">{selectedMed.brandNames[0]}</p>

            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground uppercase tracking-wider">Starting Dose</label>
                <div className="grid grid-cols-3 gap-2">
                  {selectedMed.doses.map((d: number) => (
                    <button
                      key={d}
                      className={`rounded-xl py-3 text-sm font-bold border-2 transition-all ${
                        selectedDose === d ? "border-[#D4A574] bg-[#D4A574] text-white" : "border-border bg-card shadow-sm"
                      }`}
                      onClick={() => {setSelectedDose(d); haptic();}}
                    >
                      {d} {selectedMed.unit}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-bold text-foreground uppercase tracking-wider">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl h-12 bg-card shadow-sm" />
              </div>

              {selectedMed.formulation === "injection" && (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-foreground uppercase tracking-wider">First Injection Site</label>
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 grid grid-cols-1 gap-2">
                      {INJECTION_SITES.map((site) => (
                        <button
                          key={site}
                          className={`rounded-xl py-3 text-sm font-bold border-2 transition-all ${
                            injectionSite === site ? "border-[#D4A574] bg-[#D4A574]/10 text-[#D4A574]" : "border-border bg-card shadow-sm"
                          }`}
                          onClick={() => {setInjectionSite(site); haptic();}}
                        >
                          {site}
                        </button>
                      ))}
                    </div>
                    <div className="w-24 h-40 bg-muted/30 rounded-2xl flex items-center justify-center p-2 relative">
                      {BODY_SVG}
                      {/* Highlight dots */}
                      {injectionSite === "Abdomen" && <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-4 h-3 bg-[#D4A574] rounded-full blur-[2px]" />}
                      {injectionSite === "Thigh" && <div className="absolute top-[65%] left-[40%] w-3 h-5 bg-[#D4A574] rounded-full blur-[2px]" />}
                      {injectionSite === "Upper Arm" && <div className="absolute top-[35%] left-[25%] w-3 h-5 bg-[#D4A574] rounded-full blur-[2px]" />}
                      {injectionSite === "Buttocks" && <div className="absolute top-[55%] left-[40%] w-4 h-4 bg-[#D4A574] rounded-full blur-[2px]" />}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border shadow-sm">
                <div>
                  <p className="text-sm font-bold text-foreground">Injection Reminders</p>
                  <p className="text-xs text-muted-foreground">Get notified on dose days</p>
                </div>
                <button
                  onClick={() => {setReminderEnabled(!reminderEnabled); haptic();}}
                  className="relative w-12 h-6 rounded-full flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: reminderEnabled ? '#D4A574' : 'var(--color-muted)' }}
                >
                  <motion.span layout transition={{ type: "spring", stiffness: 700, damping: 30 }} className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md" style={{ left: reminderEnabled ? 'calc(100% - 22px)' : '2px' }} />
                </button>
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#D4A574' }}
              disabled={!selectedDose}
              onClick={() => handleNext(12)}
            >
              Craft My Plan
            </Button>
          </motion.div>
        )}

        {step === 12 && (
          <motion.div
            key="s12" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center bg-card rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] mt-12 border-t border-border"
          >
            <div className="relative w-32 h-32 mb-8">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="var(--color-muted)" strokeWidth="6" fill="none" />
                <motion.circle
                  cx="64" cy="64" r="60" stroke="#D4A574" strokeWidth="6" fill="none" strokeLinecap="round"
                  initial={{ strokeDasharray: 377, strokeDashoffset: 377 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 2.5, ease: "linear" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-[#D4A574]" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-8">Crafting your custom Jotrea plan...</h2>
            
            <div className="space-y-4 w-full max-w-xs text-left">
              {[
                { label: "Building your dose schedule...", tick: 0 },
                { label: "Calculating your weight timeline...", tick: 1 },
                { label: "Preparing side effect tips...", tick: 2 },
                { label: "Setting reminder preferences...", tick: 3 }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-300 ${loadingTicks >= item.tick ? "bg-[#D4A574]" : "bg-muted"}`}>
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                  <span className={`text-sm font-medium transition-colors duration-300 ${loadingTicks >= item.tick ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {step === 13 && (
          <motion.div
            key="s13" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col px-6 pt-2 pb-6 justify-center"
          >
            <div className="w-16 h-16 bg-[#D4A574]/20 rounded-full flex items-center justify-center mb-6">
              <Target size={32} className="text-[#D4A574]" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Your Plan is Ready</h2>
            <p className="text-muted-foreground mb-8">Congratulations! Your personal Jotrea plan is tailored to you.</p>
            
            <div className="bg-card rounded-3xl p-6 border border-border shadow-[0_4px_12px_rgba(0,0,0,0.05)] mb-6">
              <p className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider">Timeline</p>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-2">
                <span>Start</span>
                <span>Goal</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full mb-6 overflow-hidden">
                <div className="h-full bg-[#D4A574] w-[15%]" />
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground">Shot Schedule</span>
                <span className="text-sm font-bold">{selectedMed?.frequency === "weekly" ? "Weekly" : "Daily"}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-muted-foreground">Next Site</span>
                <span className="text-sm font-bold">{selectedMed?.formulation === "injection" ? injectionSite : "Oral"}</span>
              </div>
            </div>
            
            <p className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider px-2">Daily Goals</p>
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-card rounded-2xl p-4 border border-border text-center shadow-sm">
                <Droplets size={20} className="text-blue-500 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Water</p>
                <p className="text-sm font-bold">8 glasses</p>
              </div>
              <div className="bg-card rounded-2xl p-4 border border-border text-center shadow-sm">
                <Activity size={20} className="text-red-500 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Protein</p>
                <p className="text-sm font-bold">{Math.round((heightUnit === "imperial" ? parseFloat(currentWeight)/2.2 : parseFloat(currentWeight)) * 0.8)}g</p>
              </div>
              <div className="bg-card rounded-2xl p-4 border border-border text-center shadow-sm">
                <Target size={20} className="text-green-500 mx-auto mb-2" />
                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Steps</p>
                <p className="text-sm font-bold">8k</p>
              </div>
            </div>

            <Button
              className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 hover:opacity-90"
              style={{ backgroundColor: '#D4A574' }}
              onClick={() => handleNext(14)}
            >
              Let's Get Started
            </Button>
          </motion.div>
        )}

        {step === 14 && (
          <motion.div
            key="s14" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.3, ease: transitionEase }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <div className="w-24 h-24 bg-[#D4A574]/10 rounded-full flex items-center justify-center mb-8">
              <Bell size={40} className="text-[#D4A574]" />
            </div>
            
            <h2 className="text-3xl font-bold text-foreground mb-4">Reach Your Goal with Notifications.</h2>
            <p className="text-muted-foreground mb-12">Turn on Push Notifications to unlock smart reminders on your dose days.</p>
            
            <div className="w-full space-y-4">
              <Button
                className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white hover:opacity-90"
                style={{ backgroundColor: '#D4A574' }}
                onClick={async () => {
                  haptic();
                  setLocation("/", { replace: true });
                }}
              >
                Allow Notifications
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 rounded-2xl text-base font-bold text-muted-foreground border-2 hover:bg-muted"
                onClick={() => { haptic(); setLocation("/", { replace: true }); }}
              >
                Don't Allow
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
