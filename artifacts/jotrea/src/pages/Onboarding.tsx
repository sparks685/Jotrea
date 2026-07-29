import { useState, useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Search, Syringe, Pill, Check, Info, Bell,
  Droplets, Target, Activity, CheckCircle2, Flame, Heart,
  Zap, Wind, TrendingDown, Calendar, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { medications } from "@/data/medications";
import { useMedication, useDoses, useWeights, useUser } from "@/hooks/useMedication";
import { format, subDays, subWeeks, addWeeks } from "date-fns";
import { calculateBMI, calculateBMIFromKg } from "@/utils/calculations";

const INJECTION_SITES = ["Abdomen", "Thigh", "Upper Arm", "Buttocks"];
const BRAND = "#D4A574";

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
  const demoDoses: any[] = [];
  if (frequency === "weekly") {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({ id: `d${i}`, date: format(subWeeks(today, i), "yyyy-MM-dd"), time: "09:00", doseAmount: dose, site: INJECTION_SITES[i % 4], notes: "", taken: true });
    }
  } else {
    for (let i = 4; i >= 1; i--) {
      demoDoses.push({ id: `d${i}`, date: format(subDays(today, i), "yyyy-MM-dd"), time: "08:00", doseAmount: dose, site: INJECTION_SITES[0], notes: "", taken: true });
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
  enter: (direction: number) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 48 : -48, opacity: 0 }),
};
const ease = [0.4, 0, 0.2, 1] as const;

// ── Shared micro-components ────────────────────────────────────────────────
const BackBtn = ({ onBack }: { onBack: () => void }) => (
  <button onClick={onBack} className="w-10 h-10 rounded-full bg-card border border-border shadow-sm flex items-center justify-center hover:bg-muted/60 transition-all active:scale-95">
    <ChevronLeft size={20} className="text-foreground" />
  </button>
);

const StepBadge = ({ icon }: { icon: React.ReactNode }) => (
  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5 shadow-sm" style={{ background: `${BRAND}18`, border: `1.5px solid ${BRAND}28`, color: BRAND }}>
    {icon}
  </div>
);

const ContinueBtn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <Button
    className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-8 disabled:opacity-40 disabled:cursor-not-allowed"
    style={{ backgroundColor: BRAND }}
    disabled={disabled}
    onClick={onClick}
  >
    {children}
  </Button>
);

// ── Main component ─────────────────────────────────────────────────────────
export default function Onboarding() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [gender, setGender] = useState("");
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

  const [goalWeight, setGoalWeight] = useState("");
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

  // ── Custom ("Other") medication state ───────────────────────────────────
  const [isCustomMed, setIsCustomMed] = useState(false);
  const [customBrand, setCustomBrand] = useState("");
  const [customGeneric, setCustomGeneric] = useState("");
  const [customStrength, setCustomStrength] = useState("");
  const [customFormulation, setCustomFormulation] = useState<"injection"|"pill"|"other">("injection");
  const [customDoseAmt, setCustomDoseAmt] = useState("");
  const [customFrequency, setCustomFrequency] = useState("weekly");
  const [customFreqOther, setCustomFreqOther] = useState("");

  const { setMedication } = useMedication();
  const { setDoses } = useDoses();
  const { setWeights } = useWeights();
  const { user, setUser } = useUser();

  const rMin = heightUnit === "imperial" ? 80 : 30;
  const rMax = heightUnit === "imperial" ? 400 : 200;

  const nav = (next: number) => { haptic(); setDirection(1); setStep(next); };
  const back = () => { haptic(); setDirection(-1); setStep(step === 10 ? 9 : step - 1); };

  const grouped = medications.reduce<Record<string, typeof medications>>((acc, med) => {
    if (!acc[med.genericName]) acc[med.genericName] = [];
    acc[med.genericName].push(med);
    return acc;
  }, {});
  const filteredGrouped = Object.entries(grouped).reduce<Record<string, typeof medications>>(
    (acc, [g, meds]) => {
      const f = meds.filter(m => m.genericName.toLowerCase().includes(search.toLowerCase()) || m.brandNames.some(b => b.toLowerCase().includes(search.toLowerCase())));
      if (f.length) acc[g] = f;
      return acc;
    }, {}
  );

  const handleComplete = () => {
    const cw = parseFloat(currentWeight), sw = parseFloat(startWeight) || cw, gw = parseFloat(goalWeight);
    if (isCustomMed) {
      const freq = customFrequency === "other" ? (customFreqOther || "custom") : customFrequency;
      const dose = parseFloat(customDoseAmt) || 0;
      setMedication({ id: "custom", genericName: customGeneric || customBrand, brandName: customBrand, dose, frequency: freq, startDate, injectionSite: customFormulation === "injection" ? injectionSite : undefined, active: true });
      setUser({ name: user.name || "User", gender: gender as any, birthday: `${bYear}-${bMonth.padStart(2,"0")}-${bDay.padStart(2,"0")}`, heightUnit, heightFt: parseInt(heightFt), heightIn: parseInt(heightIn), heightCm: parseInt(heightCm), currentWeightLbs: heightUnit === "imperial" ? cw : undefined, currentWeightKg: heightUnit === "metric" ? cw : undefined, startingWeightLbs: heightUnit === "imperial" ? sw : undefined, startingWeightKg: heightUnit === "metric" ? sw : undefined, glpStartDate: startDateGlp, goalWeightLbs: heightUnit === "imperial" ? gw : undefined, goalWeightKg: heightUnit === "metric" ? gw : undefined, goalPaceLbs: goalPace, activityLevel: activity as any, motivations, troublesomeSideEffects: sideEffects, units: heightUnit === "imperial" ? "lbs" : "kg", subscription: "free" });
      seedDemoData("custom", freq, dose, setDoses, setWeights);
      trackEvent("onboarding_complete", { medication: customBrand || "custom" });
    } else {
      if (!selectedMed || !selectedDose) return;
      setMedication({ id: selectedMed.id, genericName: selectedMed.genericName, brandName: selectedMed.brandNames[0], dose: selectedDose, frequency: selectedMed.frequency, startDate, injectionSite: selectedMed.formulation === "injection" ? injectionSite : undefined, active: true });
      setUser({ name: user.name || "User", gender: gender as any, birthday: `${bYear}-${bMonth.padStart(2,"0")}-${bDay.padStart(2,"0")}`, heightUnit, heightFt: parseInt(heightFt), heightIn: parseInt(heightIn), heightCm: parseInt(heightCm), currentWeightLbs: heightUnit === "imperial" ? cw : undefined, currentWeightKg: heightUnit === "metric" ? cw : undefined, startingWeightLbs: heightUnit === "imperial" ? sw : undefined, startingWeightKg: heightUnit === "metric" ? sw : undefined, glpStartDate: startDateGlp, goalWeightLbs: heightUnit === "imperial" ? gw : undefined, goalWeightKg: heightUnit === "metric" ? gw : undefined, goalPaceLbs: goalPace, activityLevel: activity as any, motivations, troublesomeSideEffects: sideEffects, units: heightUnit === "imperial" ? "lbs" : "kg", subscription: "free" });
      seedDemoData(selectedMed.id, selectedMed.frequency, selectedDose, setDoses, setWeights);
      trackEvent("onboarding_complete", { medication: selectedMed.genericName });
    }
  };

  // ── Goal Weight Ruler — state-driven drag (no scroll position math) ────────
  // goalWeight is the single source of truth. Ticks render around it; drag updates it.
  // This eliminates all scrollLeft timing bugs that afflict programmatic scroll in iframes.
  const dragStartXRef = useRef<number | null>(null);
  const dragStartValRef = useRef<number>(150);
  const lastDragValRef = useRef<number>(150);
  // Tracks whether the first-entry bounce hint has already played.
  const hintPlayedRef = useRef(false);

  // Initialise goalWeight whenever step 5 is entered going forward.
  // Going backward preserves whatever the user already chose.
  // On first entry, plays a one-time nudge left then snap back so users
  // discover the ruler is interactive.
  useEffect(() => {
    if (step === 5 && direction === 1) {
      const raw = startWeight || currentWeight || "150";
      const val = Math.min(rMax, Math.max(rMin, parseInt(raw) || 150));
      setGoalWeight(val.toString());

      if (!hintPlayedRef.current) {
        hintPlayedRef.current = true;
        // Nudge to a lower value (visually slides left) then snap back
        const t1 = setTimeout(() => { setGoalWeight((val - 1).toString()); haptic(4); }, 400);
        const t2 = setTimeout(() => { setGoalWeight(val.toString()); haptic(4); }, 800);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const [loadingTicks, setLoadingTicks] = useState(0);
  useEffect(() => {
    if (step !== 12) return;
    const t1 = setTimeout(() => { setLoadingTicks(1); haptic(); }, 700);
    const t2 = setTimeout(() => { setLoadingTicks(2); haptic(); }, 1500);
    const t3 = setTimeout(() => { setLoadingTicks(3); haptic(); }, 2200);
    const t4 = setTimeout(() => { handleComplete(); haptic([10,30,10]); setStep(13); }, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [step]);

  return (
    <div className="h-[100dvh] bg-background flex flex-col overflow-hidden" style={{ paddingTop:"env(safe-area-inset-top)", paddingBottom:"env(safe-area-inset-bottom)" }}>

      {/* Progress bar */}
      <div className="flex-shrink-0 h-[3px] bg-muted/50">
        {step > 0 && step <= 14 && (
          <motion.div className="h-full rounded-full" style={{ backgroundColor: BRAND }}
            initial={false} animate={{ width:`${(step/14)*100}%` }} transition={{ duration:0.4, ease }} />
        )}
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>

        {/* ─── Step 0: Welcome ─────────────────────────────────────── */}
        {step === 0 && (
          <motion.div key="s0" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col items-center justify-center px-7 text-center gap-7">

            <div className="space-y-3">
              <div className="w-24 h-24 rounded-[28px] flex items-center justify-center mx-auto shadow-2xl"
                style={{ background:`linear-gradient(135deg, #e8b989, ${BRAND})`, boxShadow:`0 20px 60px ${BRAND}45` }}>
                <Syringe size={42} className="text-white" strokeWidth={1.8} />
              </div>
              <h1 className="text-4xl font-black text-foreground tracking-tight">Jotrea</h1>
              <p className="text-base text-muted-foreground font-medium">Your GLP-1 Journey, Simplified</p>
            </div>

            <div className="w-full max-w-xs bg-card rounded-3xl border border-border/60 p-6 space-y-4 text-left"
              style={{ boxShadow:"0 6px 28px rgba(0,0,0,0.06)" }}>
              {[
                { icon:<CheckCircle2 size={15}/>, text:"Track doses effortlessly" },
                { icon:<TrendingDown size={15}/>, text:"Monitor your weight progress" },
                { icon:<Bell size={15}/>, text:"Smart injection reminders" },
                { icon:<Heart size={15}/>, text:"Pharmacist-curated guidance" },
              ].map(item => (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:`${BRAND}18`, color:BRAND }}>{item.icon}</div>
                  <span className="text-sm font-medium text-foreground">{item.text}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              ★★★★★&nbsp; Trusted by <strong className="text-foreground">10,000+</strong> GLP-1 patients
            </p>

            <div className="w-full max-w-xs">
              <Button className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-xl"
                style={{ backgroundColor:BRAND, boxShadow:`0 8px 32px ${BRAND}45` }}
                onClick={() => nav(1)}>
                Start Your Journey
              </Button>
            </div>
          </motion.div>
        )}

        {/* ─── Step 1: Gender ──────────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="s1" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Heart size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">How do you identify?</h2>
            <p className="text-muted-foreground mb-8 text-sm">Helps us personalise your health plan.</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id:"female", label:"Female", emoji:"♀" },
                { id:"male", label:"Male", emoji:"♂" },
                { id:"nonbinary", label:"Non-binary", emoji:"⚧" },
                { id:"prefer_not_to_say", label:"Prefer not to say", emoji:"—" },
              ].map(opt => {
                const sel = gender === opt.id;
                return (
                  <motion.button key={opt.id} whileTap={{ scale:0.96 }}
                    onClick={() => { setGender(opt.id); haptic(); }}
                    className="h-[118px] flex flex-col items-center justify-center gap-2 rounded-3xl border-2 transition-all shadow-sm"
                    style={{ backgroundColor:sel?`${BRAND}12`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))" }}>
                    <span className="text-3xl">{opt.emoji}</span>
                    <span className={`font-bold text-sm ${sel?"text-foreground":"text-muted-foreground"}`}>{opt.label}</span>
                    {sel && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor:BRAND }}><Check size={11} className="text-white" strokeWidth={3}/></div>}
                  </motion.button>
                );
              })}
            </div>
            <ContinueBtn onClick={() => nav(2)} disabled={!gender}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 2: Birthday ────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="s2" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Calendar size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">When's your birthday?</h2>
            <p className="text-muted-foreground mb-7 text-sm">Used to personalise dosing recommendations.</p>

            <div className="flex gap-3 bg-card p-6 rounded-3xl border border-border/60 mb-4" style={{ boxShadow:"0 4px 20px rgba(0,0,0,0.05)" }}>
              {[
                { value:bMonth, set:(v:string)=>{setBMonth(v);haptic();}, options:Array.from({length:12},(_,i)=>({ v:String(i+1), l:new Date(2000,i,1).toLocaleString("default",{month:"short"}) })), label:"Month" },
                { value:bDay, set:(v:string)=>{setBDay(v);haptic();}, options:Array.from({length:31},(_,i)=>({ v:String(i+1), l:String(i+1) })), label:"Day" },
                { value:bYear, set:(v:string)=>{setBYear(v);haptic();}, options:Array.from({length:100},(_,i)=>{ const y=new Date().getFullYear()-i; return { v:String(y), l:String(y) }; }), label:"Year" },
              ].map((col,ci) => (
                <div key={ci} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{col.label}</span>
                  <select value={col.value} onChange={e=>col.set(e.target.value)} className="bg-transparent text-xl font-bold text-center appearance-none outline-none w-full">
                    {col.options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <p className="text-center text-sm text-muted-foreground mb-2">
              Age: <strong className="text-foreground">{new Date().getFullYear() - parseInt(bYear)}</strong>
            </p>
            <ContinueBtn onClick={() => nav(3)}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 3: Height & Weight ─────────────────────────────── */}
        {step === 3 && (
          <motion.div key="s3" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Activity size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Your measurements</h2>
            <p className="text-muted-foreground mb-6 text-sm">Used to calculate BMI and personalise your plan.</p>

            <div className="flex bg-muted/60 p-1 rounded-xl w-fit mx-auto mb-6">
              {(["imperial","metric"] as const).map(u => (
                <button key={u} onClick={()=>{setHeightUnit(u);haptic();}}
                  className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${heightUnit===u?"bg-card shadow text-foreground":"text-muted-foreground"}`}>
                  {u==="imperial"?"Imperial":"Metric"}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mb-6">
              <div className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm p-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2 text-center">Height</p>
                {heightUnit==="imperial" ? (
                  <div className="flex gap-1 justify-center">
                    <select value={heightFt} onChange={e=>{setHeightFt(e.target.value);haptic();}} className="bg-transparent text-lg font-bold outline-none appearance-none text-center">
                      {[3,4,5,6,7].map(v=><option key={v} value={v}>{v} ft</option>)}
                    </select>
                    <select value={heightIn} onChange={e=>{setHeightIn(e.target.value);haptic();}} className="bg-transparent text-lg font-bold outline-none appearance-none text-center">
                      {Array.from({length:12},(_,i)=><option key={i} value={i}>{i} in</option>)}
                    </select>
                  </div>
                ) : (
                  <select value={heightCm} onChange={e=>{setHeightCm(e.target.value);haptic();}} className="bg-transparent text-lg font-bold outline-none appearance-none text-center w-full">
                    {Array.from({length:100},(_,i)=><option key={i+130} value={i+130}>{i+130} cm</option>)}
                  </select>
                )}
              </div>
              <div className="flex-1 bg-card rounded-2xl border border-border/60 shadow-sm p-4">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2 text-center">Weight</p>
                <select value={currentWeight} onChange={e=>{setCurrentWeight(e.target.value);haptic();}} className="bg-transparent text-lg font-bold outline-none appearance-none text-center w-full">
                  {heightUnit==="imperial"
                    ? Array.from({length:301},(_,i)=><option key={i+100} value={i+100}>{i+100} lbs</option>)
                    : Array.from({length:161},(_,i)=><option key={i+40} value={i+40}>{i+40} kg</option>)
                  }
                </select>
              </div>
            </div>

            {(() => {
              const bmi = heightUnit==="imperial"
                ? calculateBMI(parseFloat(currentWeight), parseInt(heightFt)*12+parseInt(heightIn))
                : calculateBMIFromKg(parseFloat(currentWeight), parseInt(heightCm));
              let label="Healthy", color="#22c55e";
              if(bmi<18.5){label="Underweight";color="#3b82f6";}
              else if(bmi>=25&&bmi<30){label="Overweight";color="#f59e0b";}
              else if(bmi>=30){label="Obese";color="#ef4444";}
              return (
                <div className="flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border"
                    style={{ background:`${color}12`, borderColor:`${color}30`, color }}>
                    <Activity size={13}/>
                    BMI {bmi.toFixed(1)} — {label}
                  </div>
                </div>
              );
            })()}

            <ContinueBtn onClick={() => { if(!startWeight) setStartWeight(currentWeight); nav(4); }}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 4: Start Weight & Date ─────────────────────────── */}
        {step === 4 && (
          <motion.div key="s4" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<TrendingDown size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Where did you start?</h2>
            <p className="text-muted-foreground mb-7 text-sm">Helps us calculate your total progress so far.</p>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Starting Weight ({heightUnit==="imperial"?"lbs":"kg"})</label>
                <Input type="number" value={startWeight} onChange={e=>setStartWeight(e.target.value)} placeholder={currentWeight}
                  className="h-14 rounded-2xl text-lg px-4 bg-card shadow-sm border-border/60 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">GLP-1 Start Date</label>
                <Input type="date" value={startDateGlp} onChange={e=>setStartDateGlp(e.target.value)}
                  className="h-14 rounded-2xl text-base px-4 bg-card shadow-sm border-border/60" />
              </div>
            </div>

            {startWeight && parseFloat(startWeight) > parseFloat(currentWeight) && (
              <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                className="mt-5 flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background:`${BRAND}12`, border:`1px solid ${BRAND}25` }}>
                <TrendingDown size={16} style={{ color:BRAND }} className="flex-shrink-0"/>
                <p className="text-sm font-semibold" style={{ color:BRAND }}>
                  You've already lost {(parseFloat(startWeight)-parseFloat(currentWeight)).toFixed(1)} {heightUnit==="imperial"?"lbs":"kg"}. Keep going!
                </p>
              </motion.div>
            )}

            <ContinueBtn disabled={!startWeight} onClick={() => {
              if (!goalWeight) {
                const raw = startWeight || currentWeight || "150";
                setGoalWeight(Math.min(rMax, Math.max(rMin, parseInt(raw)||rMin)).toString());
              }
              nav(5);
            }}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 5: Goal Weight ─────────────────────────────────── */}
        {step === 5 && (
          <motion.div key="s5" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Target size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Your dream weight</h2>
            <p className="text-muted-foreground mb-5 text-sm">Drag the ruler or tap +/− to set your goal.</p>

            {/* Large number display */}
            {(() => {
              const gw = Math.min(rMax, Math.max(rMin, parseInt(goalWeight) || rMin));
              const sw = parseFloat(startWeight || currentWeight);
              const diff = sw - gw;
              return (
                <div className="text-center mb-4">
                  <span style={{ fontSize:'12px', fontWeight:800, color:BRAND, letterSpacing:'0.1em', textTransform:'uppercase' }}>Dream weight</span>
                  <div className="mt-1 flex items-baseline justify-center gap-2">
                    <motion.span key={goalWeight} initial={{ opacity:0.7, y:-6 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.1 }}
                      className="text-7xl font-black text-foreground tracking-tight">{gw}</motion.span>
                    <span className="text-xl text-muted-foreground font-normal">{heightUnit==="imperial"?"lbs":"kg"}</span>
                  </div>
                  {!isNaN(diff) && diff > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      That's <strong className="text-foreground">{diff.toFixed(0)} {heightUnit==="imperial"?"lbs":"kg"}</strong> from your starting weight
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── Drag ruler — state-driven, no scrollLeft ─────────────────── */}
            {(() => {
              const gw = Math.min(rMax, Math.max(rMin, parseInt(goalWeight) || rMin));
              const HALF = 20; // ticks shown either side of centre
              const TOTAL = HALF * 2 + 1;

              const changeBy = (delta: number) => {
                const next = Math.min(rMax, Math.max(rMin, gw + delta));
                setGoalWeight(next.toString());
                haptic(5);
              };

              return (
                <>
                  {/* Ruler card */}
                  <div className="relative w-full rounded-2xl overflow-hidden select-none" style={{
                    height:'140px',
                    border:`1.5px solid ${BRAND}38`,
                    boxShadow:`0 6px 32px ${BRAND}18, 0 1px 4px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)`,
                    background:'rgba(255,252,248,0.7)',
                    touchAction:'none',
                    cursor:'ew-resize',
                  }}
                    onPointerDown={e => {
                      dragStartXRef.current = e.clientX;
                      dragStartValRef.current = gw;
                      lastDragValRef.current = gw;
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                      if (dragStartXRef.current === null) return;
                      // drag left → higher value (ruler moves right → number goes up)
                      const dx = dragStartXRef.current - e.clientX;
                      const delta = Math.round(dx / 7); // 7 px per unit
                      const next = Math.min(rMax, Math.max(rMin, dragStartValRef.current + delta));
                      if (next !== lastDragValRef.current) {
                        lastDragValRef.current = next;
                        setGoalWeight(next.toString());
                        haptic(3);
                      }
                    }}
                    onPointerUp={() => { dragStartXRef.current = null; }}
                    onPointerCancel={() => { dragStartXRef.current = null; }}
                  >
                    {/* iOS-style selection band */}
                    <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none rounded-xl" style={{
                      top:'10px', bottom:'36px', width:'52px',
                      background:`${BRAND}0e`, border:`1px solid ${BRAND}2e`,
                    }}/>
                    {/* Centre needle */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none rounded-full" style={{
                      width:'2.5px',
                      background:`linear-gradient(to bottom, transparent 0%, ${BRAND} 10%, ${BRAND} 74%, ${BRAND}20 100%)`,
                      boxShadow:`0 0 12px ${BRAND}55, 0 2px 6px ${BRAND}35`,
                    }}/>
                    {/* Edge fade */}
                    <div className="absolute inset-0 z-10 pointer-events-none" style={{
                      background:`linear-gradient(to right, rgba(255,252,248,0.85) 0%, transparent 18%, transparent 82%, rgba(255,252,248,0.85) 100%)`,
                    }}/>

                    {/* Ticks — state-driven, always centred on gw */}
                    <div className="absolute inset-0 flex items-end pb-[34px]" style={{ paddingBottom:'34px' }}>
                      {Array.from({ length: TOTAL }, (_, i) => {
                        const offset = i - HALF;
                        const val = gw + offset;
                        const is5 = val % 5 === 0;
                        const dist = Math.abs(offset);
                        const inRange = val >= rMin && val <= rMax;

                        if (!inRange) return <div key={i} style={{ flex:1 }} />;

                        let tickH: number;
                        if      (dist===0) tickH=68;
                        else if (dist===1) tickH=is5?48:34;
                        else if (dist===2) tickH=is5?38:24;
                        else if (dist<=4)  tickH=is5?28:14;
                        else if (dist<=8)  tickH=is5?20:8;
                        else               tickH=is5?14:5;

                        const t = Math.min(1, dist / 8);
                        const cr = Math.round(212 + (200-212)*t);
                        const cg = Math.round(165 + (210-165)*t);
                        const cb = Math.round(116 + (210-116)*t);
                        const ca = dist===0 ? 1 : Math.max(0.12, 0.88 - dist*0.1);

                        return (
                          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end' }}>
                            <div style={{
                              width: dist===0 ? '3px' : is5 ? '2.5px' : '2px',
                              height:`${tickH}px`,
                              backgroundColor:`rgba(${cr},${cg},${cb},${ca})`,
                              borderRadius:'9999px',
                              boxShadow: dist===0 ? `0 0 10px ${BRAND}55` : 'none',
                              transition:'height 0.09s ease, background-color 0.09s ease',
                            }}/>
                          </div>
                        );
                      })}
                    </div>

                    {/* Labels row */}
                    <div className="absolute bottom-[6px] left-0 right-0 flex pointer-events-none">
                      {Array.from({ length: TOTAL }, (_, i) => {
                        const offset = i - HALF;
                        const val = gw + offset;
                        const dist = Math.abs(offset);
                        if (val % 5 !== 0 || val < rMin || val > rMax) return <div key={i} style={{ flex:1 }}/>;
                        return (
                          <div key={i} style={{ flex:1, display:'flex', justifyContent:'center' }}>
                            <span style={{
                              fontSize:'11px',
                              fontWeight: dist===0 ? 800 : 500,
                              color: dist===0 ? 'hsl(var(--foreground))' : `rgba(156,163,175,${Math.max(0.2, 0.65-dist*0.05)})`,
                              userSelect:'none',
                            }}>{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* +/− stepper buttons */}
                  <div className="flex items-center justify-center gap-4 mt-3">
                    {[
                      { label:"−5", delta:-5 }, { label:"−1", delta:-1 },
                      { label:"+1", delta:1 }, { label:"+5", delta:5 },
                    ].map(btn => (
                      <motion.button key={btn.label} whileTap={{ scale:0.92 }}
                        onClick={() => changeBy(btn.delta)}
                        className="w-14 h-10 rounded-xl text-sm font-bold border-2 transition-all"
                        style={{ borderColor:`${BRAND}40`, color:BRAND, background:`${BRAND}0a` }}>
                        {btn.label}
                      </motion.button>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Timeline badge */}
            {(() => {
              const diff = parseFloat(currentWeight) - parseFloat(goalWeight);
              const weeks = Math.max(0, diff / goalPace);
              return (
                <div className="text-center mt-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background:`${BRAND}14`, color:BRAND }}>
                    <Target size={13}/>
                    At this pace, you'll reach this by {format(addWeeks(new Date(), weeks), "MMMM yyyy")}
                  </div>
                </div>
              );
            })()}

            <ContinueBtn onClick={() => nav(6)}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 6: Goal Pace ───────────────────────────────────── */}
        {step === 6 && (
          <motion.div key="s6" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Zap size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Set your pace</h2>
            <p className="text-muted-foreground mb-6 text-sm">How quickly do you want to reach your goal?</p>

            <div className="space-y-3 mb-6">
              {[
                { value:0.5, emoji:"🚶", label:"Steady", desc:`0.5 ${heightUnit==="imperial"?"lbs":"kg"}/week — gentle, sustainable` },
                { value:1.0, emoji:"🚗", label:"Moderate", desc:`1.0 ${heightUnit==="imperial"?"lbs":"kg"}/week — balanced & effective`, recommended:true },
                { value:1.5, emoji:"⚡", label:"Accelerated", desc:`1.5 ${heightUnit==="imperial"?"lbs":"kg"}/week — faster results` },
                { value:2.0, emoji:"🚀", label:"Aggressive", desc:`2.0 ${heightUnit==="imperial"?"lbs":"kg"}/week — clinical supervision advised` },
              ].map(opt => {
                const sel = goalPace === opt.value;
                return (
                  <motion.button key={opt.value} whileTap={{ scale:0.98 }}
                    onClick={() => { setGoalPace(opt.value); haptic(); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all shadow-sm"
                    style={{ backgroundColor:sel?`${BRAND}12`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))" }}>
                    <span className="text-2xl">{opt.emoji}</span>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{opt.label}</span>
                        {opt.recommended && <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background:`${BRAND}20`, color:BRAND }}>RECOMMENDED</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ borderColor:sel?BRAND:"hsl(var(--border))", backgroundColor:sel?BRAND:"transparent" }}>
                      {sel && <Check size={10} className="text-white" strokeWidth={3}/>}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {(() => {
              const diff=parseFloat(currentWeight)-parseFloat(goalWeight);
              const weeks=Math.max(0,diff/goalPace);
              return (
                <div className="flex justify-center mb-2">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white shadow-md"
                    style={{ backgroundColor:BRAND, boxShadow:`0 4px 16px ${BRAND}45` }}>
                    <Star size={13}/>
                    Goal date: {format(addWeeks(new Date(),weeks),"MMMM yyyy")}
                  </div>
                </div>
              );
            })()}

            <ContinueBtn onClick={() => nav(7)}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 7: Activity Level ──────────────────────────────── */}
        {step === 7 && (
          <motion.div key="s7" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Flame size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Your daily activity</h2>
            <p className="text-muted-foreground mb-7 text-sm">Be honest — it helps calibrate your plan.</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id:"sedentary", label:"Sedentary", desc:"Desk work, mostly sitting", emoji:"💺" },
                { id:"lightly_active", label:"Lightly Active", desc:"Walks, light movement", emoji:"🚶" },
                { id:"active", label:"Active", desc:"Regular gym or active job", emoji:"🏃" },
                { id:"very_active", label:"Very Active", desc:"Daily intense training", emoji:"⚡" },
              ].map(opt => {
                const sel = activity === opt.id;
                return (
                  <motion.button key={opt.id} whileTap={{ scale:0.96 }}
                    onClick={() => { setActivity(opt.id); haptic(); }}
                    className="h-[130px] flex flex-col items-center justify-center gap-2 rounded-3xl border-2 transition-all shadow-sm text-center p-4"
                    style={{ backgroundColor:sel?`${BRAND}12`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))" }}>
                    <span className="text-4xl">{opt.emoji}</span>
                    <span className="font-bold text-sm text-foreground leading-tight">{opt.label}</span>
                    <span className="text-xs text-muted-foreground leading-tight">{opt.desc}</span>
                  </motion.button>
                );
              })}
            </div>
            <ContinueBtn disabled={!activity} onClick={() => nav(8)}>Continue</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 8: Motivation ──────────────────────────────────── */}
        {step === 8 && (
          <motion.div key="s8" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Heart size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">What's driving you?</h2>
            <p className="text-muted-foreground mb-6 text-sm">Select all that resonate with you.</p>

            <div className="grid grid-cols-2 gap-3">
              {[
                { text:"Feel more confident", emoji:"✨" },
                { text:"Fresh start", emoji:"🌱" },
                { text:"Boost my energy", emoji:"⚡" },
                { text:"Improve my health", emoji:"❤️" },
                { text:"Show up for loved ones", emoji:"👨‍👩‍👧" },
                { text:"Special event coming up", emoji:"🎉" },
                { text:"Feel good in my clothes", emoji:"👗" },
                { text:"Other", emoji:"💬" },
              ].map(opt => {
                const sel = motivations.includes(opt.text);
                return (
                  <motion.button key={opt.text} whileTap={{ scale:0.96 }}
                    onClick={() => { haptic(); setMotivations(prev=>sel?prev.filter(m=>m!==opt.text):[...prev,opt.text]); }}
                    className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all min-h-[90px] shadow-sm"
                    style={{ backgroundColor:sel?`${BRAND}10`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))" }}>
                    {sel && <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center shadow-md" style={{ backgroundColor:BRAND }}><Check size={10} className="text-white" strokeWidth={3}/></div>}
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className={`text-xs font-semibold text-center leading-tight ${sel?"text-foreground":"text-muted-foreground"}`}>{opt.text}</span>
                  </motion.button>
                );
              })}
            </div>
            <ContinueBtn disabled={motivations.length===0} onClick={() => nav(9)}>
              Continue {motivations.length>0&&`(${motivations.length} selected)`}
            </ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 9: Side Effects ────────────────────────────────── */}
        {step === 9 && (
          <motion.div key="s9" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 justify-center">
            <div className="mb-6"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Wind size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-1 leading-tight">Any side effects?</h2>
            <p className="text-muted-foreground mb-6 text-sm">We'll personalise tips for managing them.</p>

            <div className="flex flex-wrap gap-2.5 mb-6">
              {[
                { label:"Nausea", emoji:"🤢" }, { label:"Fatigue", emoji:"😴" },
                { label:"Hair Loss", emoji:"💇" }, { label:"Constipation", emoji:"😣" },
                { label:"Bloating", emoji:"😮‍💨" }, { label:"Sulfur Burps", emoji:"💨" },
                { label:"Heartburn", emoji:"🔥" }, { label:"Food Noise", emoji:"🍕" },
              ].map(opt => {
                const sel = sideEffects.includes(opt.label);
                return (
                  <motion.button key={opt.label} whileTap={{ scale:0.95 }}
                    onClick={() => { haptic(); setSideEffects(prev=>sel?prev.filter(m=>m!==opt.label):[...prev,opt.label]); }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border-2 transition-all"
                    style={{ backgroundColor:sel?BRAND:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))", color:sel?"white":"hsl(var(--muted-foreground))" }}>
                    <span>{opt.emoji}</span>{opt.label}
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {sideEffects.length>0 && (
                <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                  className="flex gap-3 px-4 py-3.5 rounded-2xl border mb-2 overflow-hidden"
                  style={{ background:"#fef9ec", borderColor:"#f3e5b0" }}>
                  <Info size={15} className="flex-shrink-0 mt-0.5 text-amber-600"/>
                  <p className="text-sm font-medium text-amber-900 leading-relaxed">
                    Our pharmacist team will send personalised tips for managing {sideEffects.length===1?"this":"these"}.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <ContinueBtn onClick={() => nav(10)}>{sideEffects.length===0?"None, skip":"Continue"}</ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 10: Select Medication ──────────────────────────── */}
        {step === 10 && (
          <motion.div key="s10" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col min-h-0">

            {/* Fixed header */}
            <div className="px-6 pt-3 pb-3 flex-shrink-0">
              <div className="mb-5">
                <BackBtn onBack={() => { if (isCustomMed) { setIsCustomMed(false); } else { back(); } }} />
              </div>
              <StepBadge icon={isCustomMed ? <Pill size={20}/> : <Syringe size={20}/>} />
              <h2 className="text-[28px] font-black text-foreground leading-tight">
                {isCustomMed ? "Enter your medication" : "Your medication"}
              </h2>
              <p className="text-muted-foreground text-sm mt-1 mb-4">
                {isCustomMed ? "Tell us what you're taking." : "Select your GLP-1 medication."}
              </p>
              {!isCustomMed && (
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                  <Input type="search" placeholder="Search medications..." value={search} onChange={e=>setSearch(e.target.value)}
                    className="pl-10 rounded-xl h-12 bg-card shadow-sm border-border/60"/>
                </div>
              )}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 pb-8">
              <AnimatePresence mode="wait" initial={false}>
                {!isCustomMed ? (
                  <motion.div key="list" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}
                    className="space-y-5">
                    {Object.entries(filteredGrouped).map(([generic, meds]) => (
                      <div key={generic}>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">{generic}</p>
                        <div className="space-y-2">
                          {meds.map(med => {
                            const isPill = med.formulation === "pill";
                            const sel = selectedMed?.id === med.id;
                            return (
                              <motion.button key={med.id} whileTap={{ scale:0.98 }}
                                className="w-full text-left rounded-2xl p-4 border-2 transition-all"
                                style={{ backgroundColor:sel?`${BRAND}0e`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))", boxShadow:sel?`0 4px 16px ${BRAND}25`:"0 1px 4px rgba(0,0,0,0.04)" }}
                                onClick={() => { setSelectedMed(med); setIsCustomMed(false); haptic(); nav(11); }}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground truncate">{med.brandNames.join(", ")}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{generic}</p>
                                  </div>
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
                                    style={{ background:isPill?"#3b82f618":`${BRAND}18`, color:isPill?"#3b82f6":BRAND }}>
                                    {isPill ? <Pill size={10}/> : <Syringe size={10}/>}
                                    {isPill ? "PILL" : "SHOT"}
                                  </span>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Other card */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Not listed?</p>
                      <motion.button whileTap={{ scale:0.98 }}
                        className="w-full text-left rounded-2xl p-4 border-2 transition-all"
                        style={{ backgroundColor:"hsl(var(--card))", borderColor:"hsl(var(--border))", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}
                        onClick={() => { setIsCustomMed(true); setSelectedMed(null); haptic(); }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-foreground">Other medication</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Enter your own brand & dose</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider flex-shrink-0"
                            style={{ background:"hsl(var(--muted))", color:"hsl(var(--muted-foreground))" }}>
                            CUSTOM
                          </span>
                        </div>
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Custom medication form ── */
                  <motion.div key="custom-form" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:12 }} transition={{ duration:0.2 }}
                    className="space-y-5 pt-1">

                    {/* Brand name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Brand Name *</label>
                      <Input placeholder="e.g. Ozempic, Wegovy, Mounjaro…" value={customBrand} onChange={e=>setCustomBrand(e.target.value)}
                        className="rounded-xl h-12 bg-card shadow-sm border-border/60"/>
                    </div>

                    {/* Generic name */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Generic / Active Ingredient</label>
                      <Input placeholder="e.g. Semaglutide, Tirzepatide…" value={customGeneric} onChange={e=>setCustomGeneric(e.target.value)}
                        className="rounded-xl h-12 bg-card shadow-sm border-border/60"/>
                    </div>

                    {/* Strength */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Strength</label>
                      <Input placeholder="e.g. 2.5 mg, 10 mcg…" value={customStrength} onChange={e=>setCustomStrength(e.target.value)}
                        className="rounded-xl h-12 bg-card shadow-sm border-border/60"/>
                    </div>

                    {/* Formulation */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Formulation</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([["injection","💉","Injection"],["pill","💊","Pill"],["other","🔬","Other"]] as const).map(([val,emoji,label]) => {
                          const sel = customFormulation === val;
                          return (
                            <motion.button key={val} whileTap={{ scale:0.95 }}
                              onClick={() => { setCustomFormulation(val); haptic(); }}
                              className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-all"
                              style={{ backgroundColor:sel?`${BRAND}12`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))" }}>
                              <span className="text-xl">{emoji}</span>
                              <span className={`text-xs font-bold ${sel?"text-foreground":"text-muted-foreground"}`}>{label}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      className="w-full h-14 rounded-2xl text-base font-bold shadow-lg text-white mt-2 disabled:opacity-40"
                      style={{ backgroundColor:BRAND }}
                      disabled={!customBrand.trim()}
                      onClick={() => { haptic(); nav(11); }}>
                      Continue →
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ─── Step 11: Set Dose ───────────────────────────────────── */}
        {step === 11 && (selectedMed || isCustomMed) && (
          <motion.div key="s11" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-3 pb-6 overflow-y-auto">
            <div className="mb-6 mt-2"><BackBtn onBack={back} /></div>
            <StepBadge icon={<Pill size={20}/>} />
            <h2 className="text-[28px] font-black text-foreground mb-0.5 leading-tight">Set your dose</h2>
            <p className="text-muted-foreground text-sm mb-7">
              {isCustomMed ? customBrand || "Custom medication" : selectedMed?.brandNames[0]}
            </p>

            <div className="space-y-7">

              {/* ── Standard med: pre-defined dose buttons ── */}
              {!isCustomMed && selectedMed && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Starting Dose</label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedMed.doses.map((d: number) => (
                      <motion.button key={d} whileTap={{ scale:0.95 }}
                        className="rounded-2xl py-3.5 text-sm font-bold border-2 transition-all"
                        style={{ backgroundColor:selectedDose===d?BRAND:"hsl(var(--card))", borderColor:selectedDose===d?BRAND:"hsl(var(--border))", color:selectedDose===d?"white":"hsl(var(--foreground))", boxShadow:selectedDose===d?`0 4px 16px ${BRAND}40`:"0 1px 3px rgba(0,0,0,0.04)" }}
                        onClick={() => { setSelectedDose(d); haptic(); }}>
                        {d} {selectedMed.unit}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Custom med: free-entry dose + frequency ── */}
              {isCustomMed && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Dose Amount *</label>
                    <div className="flex gap-3">
                      <Input
                        type="number" inputMode="decimal" placeholder="e.g. 2.5"
                        value={customDoseAmt} onChange={e=>setCustomDoseAmt(e.target.value)}
                        className="flex-1 rounded-xl h-12 bg-card shadow-sm border-border/60"/>
                      <div className="flex items-center justify-center px-4 rounded-xl border border-border/60 bg-card shadow-sm text-sm font-bold text-muted-foreground">
                        {customStrength ? customStrength.replace(/[\d.]/g,"").trim() || "mg" : "mg"}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Dosing Frequency</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { val:"weekly", label:"Weekly" },
                        { val:"daily", label:"Daily" },
                        { val:"twice-daily", label:"Twice Daily" },
                        { val:"monthly", label:"Monthly" },
                        { val:"other", label:"Other…" },
                      ].map(opt => {
                        const sel = customFrequency === opt.val;
                        return (
                          <motion.button key={opt.val} whileTap={{ scale:0.96 }}
                            onClick={() => { setCustomFrequency(opt.val); haptic(); }}
                            className="py-3 rounded-2xl text-sm font-bold border-2 transition-all"
                            style={{ backgroundColor:sel?`${BRAND}12`:"hsl(var(--card))", borderColor:sel?BRAND:"hsl(var(--border))", color:sel?BRAND:"hsl(var(--muted-foreground))" }}>
                            {opt.label}
                          </motion.button>
                        );
                      })}
                    </div>
                    <AnimatePresence>
                      {customFrequency === "other" && (
                        <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }} className="overflow-hidden">
                          <Input placeholder="e.g. Every 10 days, twice weekly…"
                            value={customFreqOther} onChange={e=>setCustomFreqOther(e.target.value)}
                            className="rounded-xl h-12 bg-card shadow-sm border-border/60 mt-2"/>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* Start date — shared */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Start Date</label>
                <Input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="rounded-xl h-12 bg-card shadow-sm border-border/60"/>
              </div>

              {/* Injection site — shown for injection formulations */}
              {((!isCustomMed && selectedMed?.formulation==="injection") || (isCustomMed && customFormulation==="injection")) && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">First Injection Site</label>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 grid grid-cols-1 gap-2">
                      {INJECTION_SITES.map(site => (
                        <motion.button key={site} whileTap={{ scale:0.97 }}
                          className="rounded-xl py-2.5 text-sm font-bold border-2 transition-all"
                          style={{ backgroundColor:injectionSite===site?`${BRAND}14`:"hsl(var(--card))", borderColor:injectionSite===site?BRAND:"hsl(var(--border))", color:injectionSite===site?BRAND:"hsl(var(--foreground))" }}
                          onClick={() => { setInjectionSite(site); haptic(); }}>
                          {site}
                        </motion.button>
                      ))}
                    </div>
                    <div className="w-20 h-36 bg-muted/30 rounded-2xl flex items-center justify-center p-2 relative">
                      {BODY_SVG}
                      {injectionSite==="Abdomen" && <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-4 h-3 rounded-full blur-[2px]" style={{ backgroundColor:BRAND }}/>}
                      {injectionSite==="Thigh" && <div className="absolute top-[65%] left-[38%] w-3 h-5 rounded-full blur-[2px]" style={{ backgroundColor:BRAND }}/>}
                      {injectionSite==="Upper Arm" && <div className="absolute top-[35%] left-[22%] w-3 h-5 rounded-full blur-[2px]" style={{ backgroundColor:BRAND }}/>}
                      {injectionSite==="Buttocks" && <div className="absolute top-[55%] left-[38%] w-4 h-4 rounded-full blur-[2px]" style={{ backgroundColor:BRAND }}/>}
                    </div>
                  </div>
                </div>
              )}

              {/* Reminder toggle — shared */}
              <div className="flex items-center justify-between p-4 bg-card rounded-2xl border border-border/60 shadow-sm">
                <div>
                  <p className="text-sm font-bold text-foreground">Dose Reminders</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Get notified on dose days</p>
                </div>
                <button onClick={() => { setReminderEnabled(!reminderEnabled); haptic(); }}
                  className="relative w-12 h-6 rounded-full overflow-hidden transition-colors"
                  style={{ backgroundColor:reminderEnabled?BRAND:"hsl(var(--muted))" }}>
                  <motion.span layout transition={{ type:"spring", stiffness:700, damping:30 }}
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md"
                    style={{ left:reminderEnabled?"calc(100% - 22px)":"2px" }}/>
                </button>
              </div>
            </div>

            <ContinueBtn
              disabled={isCustomMed ? (!customDoseAmt.trim() || (customFrequency==="other" && !customFreqOther.trim())) : !selectedDose}
              onClick={() => nav(12)}>
              Craft My Plan →
            </ContinueBtn>
          </motion.div>
        )}

        {/* ─── Step 12: Loading ────────────────────────────────────── */}
        {step === 12 && (
          <motion.div key="s12" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="relative w-28 h-28 mb-10">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r="50" stroke="hsl(var(--muted))" strokeWidth="6" fill="none"/>
                <motion.circle cx="56" cy="56" r="50" stroke={BRAND} strokeWidth="6" fill="none" strokeLinecap="round"
                  initial={{ strokeDasharray:314, strokeDashoffset:314 }}
                  animate={{ strokeDashoffset:0 }}
                  transition={{ duration:3.1, ease:"linear" }}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div animate={{ rotate:360 }} transition={{ duration:2, repeat:Infinity, ease:"linear" }}>
                  <Syringe size={28} style={{ color:BRAND }} strokeWidth={1.5}/>
                </motion.div>
              </div>
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2">Building your plan…</h2>
            <p className="text-sm text-muted-foreground mb-10">Personalised just for you</p>
            <div className="space-y-4 w-full max-w-xs text-left">
              {[
                { label:"Building your dose schedule", icon:<Calendar size={12}/> },
                { label:"Calculating your weight timeline", icon:<TrendingDown size={12}/> },
                { label:"Preparing side effect tips", icon:<Heart size={12}/> },
                { label:"Setting reminder preferences", icon:<Bell size={12}/> },
              ].map((item,i) => {
                const done = loadingTicks > i;
                return (
                  <motion.div key={i} className="flex items-center gap-3" animate={{ opacity:loadingTicks>=i?1:0.35 }} transition={{ duration:0.3 }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300"
                      style={{ backgroundColor:done?BRAND:"hsl(var(--muted))" }}>
                      {done?<Check size={11} className="text-white" strokeWidth={3}/>:<span style={{ color:"hsl(var(--muted-foreground))" }}>{item.icon}</span>}
                    </div>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ─── Step 13: Plan Ready ─────────────────────────────────── */}
        {step === 13 && (
          <motion.div key="s13" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col px-6 pt-8 pb-6">
            <div className="text-center mb-7">
              <motion.div initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:"spring", stiffness:280, damping:20 }}
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 shadow-xl"
                style={{ background:`radial-gradient(circle, ${BRAND}30, ${BRAND}0e)`, border:`2px solid ${BRAND}40` }}>
                <CheckCircle2 size={36} style={{ color:BRAND }}/>
              </motion.div>
              <h2 className="text-[28px] font-black text-foreground mb-2">Your plan is ready! 🎉</h2>
              <p className="text-muted-foreground text-sm">A personalised GLP-1 plan built just for you.</p>
            </div>

            <div className="bg-card rounded-3xl p-5 border border-border/60 mb-5" style={{ boxShadow:"0 4px 20px rgba(0,0,0,0.05)" }}>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">Your Timeline</p>
              <div className="flex justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                <span>Today</span><span>Goal</span>
              </div>
              <div className="w-full h-2 bg-muted/60 rounded-full mb-5 overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ backgroundColor:BRAND }}
                  initial={{ width:"0%" }} animate={{ width:"12%" }} transition={{ duration:0.8, ease:"easeOut", delay:0.3 }}/>
              </div>
              <div className="divide-y divide-border/40">
                {[
                  { label:"Medication", value:selectedMed?.brandNames[0] },
                  { label:"Schedule", value:selectedMed?.frequency ? selectedMed.frequency.charAt(0).toUpperCase() + selectedMed.frequency.slice(1) : "—" },
                  { label:"Goal Weight", value:`${goalWeight} ${heightUnit==="imperial"?"lbs":"kg"}` },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-3">
                    <span className="text-sm text-muted-foreground font-medium">{row.label}</span>
                    <span className="text-sm font-bold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Daily Goals</p>
            <div className="grid grid-cols-3 gap-3 mb-7">
              {[
                { icon:<Droplets size={17} className="text-blue-500"/>, label:"Water", value:"8 cups" },
                { icon:<Activity size={17} className="text-red-500"/>, label:"Protein", value:`${Math.round((heightUnit==="imperial"?parseFloat(currentWeight)/2.2:parseFloat(currentWeight))*0.8)}g` },
                { icon:<Target size={17} className="text-green-500"/>, label:"Steps", value:"8,000" },
              ].map(g => (
                <div key={g.label} className="bg-card rounded-2xl p-4 border border-border/60 text-center shadow-sm">
                  <div className="flex justify-center mb-2">{g.icon}</div>
                  <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">{g.label}</p>
                  <p className="text-sm font-bold">{g.value}</p>
                </div>
              ))}
            </div>

            <Button className="w-full h-14 rounded-2xl text-base font-bold text-white"
              style={{ backgroundColor:BRAND, boxShadow:`0 8px 32px ${BRAND}45` }}
              onClick={() => nav(14)}>Let's Get Started →</Button>
          </motion.div>
        )}

        {/* ─── Step 14: Notifications ──────────────────────────────── */}
        {step === 14 && (
          <motion.div key="s14" custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{ duration:0.28, ease }}
            className="flex-1 flex flex-col items-center justify-center px-7 text-center">
            <motion.div animate={{ rotate:[0,-12,12,-8,8,0] }} transition={{ delay:0.6, duration:0.8 }}
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-xl"
              style={{ background:`linear-gradient(135deg, ${BRAND}22, ${BRAND}08)`, border:`2px solid ${BRAND}30` }}>
              <Bell size={40} style={{ color:BRAND }} strokeWidth={1.8}/>
            </motion.div>

            <h2 className="text-[28px] font-black text-foreground mb-3 leading-tight">Never miss a dose</h2>
            <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-xs">
              Turn on notifications for smart reminders on your injection days and weekly weight check-ins.
            </p>

            {/* Mock notification */}
            <div className="w-full max-w-xs bg-card rounded-2xl p-4 text-left border border-border/60 mb-10" style={{ boxShadow:"0 8px 32px rgba(0,0,0,0.08)" }}>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:`${BRAND}20` }}>
                  <Syringe size={15} style={{ color:BRAND }} strokeWidth={1.8}/>
                </div>
                <div><p className="text-xs font-bold text-foreground">Jotrea · now</p></div>
              </div>
              <p className="text-sm font-semibold text-foreground">Injection day! 💉</p>
              <p className="text-xs text-muted-foreground mt-0.5">Time to take your {selectedMed?.brandNames[0]||"GLP-1"} dose today.</p>
            </div>

            <div className="w-full max-w-xs space-y-3">
              <Button className="w-full h-14 rounded-2xl text-base font-bold text-white shadow-xl"
                style={{ backgroundColor:BRAND, boxShadow:`0 8px 32px ${BRAND}45` }}
                onClick={() => { haptic([10,20,10]); setLocation("/", { replace:true }); }}>
                Allow Notifications
              </Button>
              <Button variant="outline" className="w-full h-12 rounded-2xl text-sm font-semibold text-muted-foreground border-2 hover:bg-muted"
                onClick={() => { haptic(); setLocation("/", { replace:true }); }}>
                Maybe later
              </Button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
