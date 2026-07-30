import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, TrendingDown, Target, X } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeights, useUser } from "@/hooks/useMedication";
import { calculateWeightLost, calculateAvgWeeklyLoss, calculateBMI } from "@/utils/calculations";
import { PageContainer } from "@/components/PageContainer";
import type { WeightEntry } from "@/types";

export default function WeightTracker() {
  const { weights, setWeights } = useWeights();
  const { user, setUser } = useUser();
  const [showForm, setShowForm] = useState(false);
  const [inputWeight, setInputWeight] = useState("");
  const [inputDate, setInputDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [inputNotes, setInputNotes] = useState("");
  const [heightInput, setHeightInput] = useState(user.height ? String(user.height) : "");
  const units = user.units;

  const goalNum = user.goalWeight ?? 0;
  const goalStr = goalNum > 0 ? String(goalNum) : "";

  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date));

  const chartData = sortedWeights.map((w) => ({
    date: format(parseISO(w.date), "MMM d"),
    weight: w.weight,
  }));

  const totalLost = calculateWeightLost(weights);
  const avgWeekly = calculateAvgWeeklyLoss(weights);
  const currentWeight = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].weight : null;

  let bmi = 0;
  if (currentWeight && user.height) {
    bmi =
      units === "lbs"
        ? calculateBMI(currentWeight, user.height)
        : currentWeight / Math.pow(user.height / 100, 2);
  }

  const goalProgress =
    goalNum > 0 && currentWeight && sortedWeights.length > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((sortedWeights[0].weight - currentWeight) /
              (sortedWeights[0].weight - goalNum)) *
              100
          )
        )
      : 0;

  // Estimated date to reach goal based on current weekly pace
  const goalReachDate = (() => {
    if (!goalNum || !currentWeight || currentWeight <= goalNum || avgWeekly <= 0) return null;
    const weeksNeeded = (currentWeight - goalNum) / avgWeekly;
    const d = new Date();
    d.setDate(d.getDate() + Math.ceil(weeksNeeded * 7));
    return format(d, "MMM yyyy");
  })();

  const PACE_LABELS: Record<number, string> = { 0.5: "Gentle", 1.0: "Moderate", 1.5: "Steady", 2.0: "Aggressive" };
  const paceLabel = user.goalPaceLbs ? (PACE_LABELS[user.goalPaceLbs] ?? `${user.goalPaceLbs} ${units}/wk`) : null;

  const handleAdd = () => {
    const w = parseFloat(inputWeight);
    if (!w || isNaN(w)) return;
    const entry: WeightEntry = {
      id: Date.now().toString(),
      date: inputDate,
      weight: w,
      notes: inputNotes || undefined,
    };
    setWeights([...weights, entry]);
    setInputWeight("");
    setInputNotes("");
    setShowForm(false);
  };

  const handleDeleteWeight = (id: string) => {
    setWeights(weights.filter((w) => w.id !== id));
  };

  const handleSaveHeight = () => {
    const h = parseFloat(heightInput);
    if (!isNaN(h)) setUser({ ...user, height: h });
  };

  const handleSaveGoal = (val: string) => {
    const g = parseFloat(val);
    setUser({ ...user, goalWeight: isNaN(g) ? undefined : g });
  };

  const displayWeights = [...sortedWeights].reverse();

  return (
    <PageContainer className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Weight</h1>
        <div className="flex items-center gap-2">
          <button
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
              units === "lbs" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}
            onClick={() => setUser({ ...user, units: "lbs" })}
            data-testid="units-lbs"
          >
            lbs
          </button>
          <button
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
              units === "kg" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
            }`}
            onClick={() => setUser({ ...user, units: "kg" })}
            data-testid="units-kg"
          >
            kg
          </button>
        </div>
      </div>

      {/* Dream Weight hero card */}
      {goalNum > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Your Goal</p>
              <p className="text-3xl font-bold text-foreground">{goalNum} {units}</p>
              {goalReachDate ? (
                <p className="text-xs text-muted-foreground mt-1">At your pace, you'll reach this by {goalReachDate}</p>
              ) : avgWeekly <= 0 && currentWeight ? (
                <p className="text-xs text-muted-foreground mt-1">Log more entries to see your projected date</p>
              ) : null}
            </div>
            {currentWeight && currentWeight > goalNum && (
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">To Go</p>
                <p className="text-2xl font-bold text-primary">{(currentWeight - goalNum).toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground">{units}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`grid gap-3 ${paceLabel ? "grid-cols-2" : "grid-cols-3"}`}>
        <StatCard
          label="Total Lost"
          value={totalLost > 0 ? `${totalLost.toFixed(1)}` : "—"}
          sub={units}
          icon={<TrendingDown size={14} className="text-secondary" />}
        />
        <StatCard
          label="Per Week"
          value={avgWeekly > 0 ? `${avgWeekly.toFixed(1)}` : "—"}
          sub={`${units}/wk`}
        />
        <StatCard
          label="BMI"
          value={bmi > 0 ? bmi.toFixed(1) : "—"}
          sub={bmi > 0 ? getBMICategory(bmi) : "Set height"}
        />
        {paceLabel && (
          <StatCard
            label="Goal Pace"
            value={paceLabel}
            sub={`${user.goalPaceLbs} ${units}/wk`}
          />
        )}
      </div>

      {weights.length > 0 ? (
        <div className="bg-card rounded-3xl p-4 shadow-sm border border-border">
          <p className="text-sm font-semibold text-foreground mb-3">Progress</p>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                width={30}
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(val) => [`${val} ${units}`, "Weight"]}
              />
              {goalNum > 0 && (
                <ReferenceLine
                  y={goalNum}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 4"
                  label={{ value: "Goal", position: "insideTopRight", fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="weight"
                stroke="hsl(var(--secondary))"
                strokeWidth={2.5}
                dot={{ fill: "hsl(var(--secondary))", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-center bg-card rounded-3xl border border-border">
          <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center mb-3">
            <TrendingDown size={24} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground text-sm">No weight entries yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add your first entry to see your trend</p>
        </div>
      )}

      <div className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Target size={15} className="text-primary" />
          <p className="text-sm font-semibold text-foreground">Goal Weight</p>
        </div>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder={`Goal in ${units}`}
            defaultValue={goalStr}
            onBlur={(e) => handleSaveGoal(e.target.value)}
            className="rounded-xl flex-1"
            data-testid="goal-weight-input"
          />
        </div>
        {goalNum > 0 && currentWeight && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{goalProgress.toFixed(0)}% to goal</span>
              <span>{Math.max(0, currentWeight - goalNum).toFixed(1)} {units} to go</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${goalProgress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-card rounded-3xl p-4 shadow-sm border border-border space-y-3">
        <p className="text-sm font-semibold text-foreground">Height (for BMI)</p>
        <div className="flex gap-2">
          <Input
            type="number"
            placeholder={units === "lbs" ? "Height in inches" : "Height in cm"}
            value={heightInput}
            onChange={(e) => setHeightInput(e.target.value)}
            className="rounded-xl flex-1"
            data-testid="height-input"
          />
          <Button variant="outline" className="rounded-xl" onClick={handleSaveHeight} data-testid="save-height-btn">
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">History</p>
          <Button
            size="sm"
            className="rounded-xl gap-1"
            onClick={() => setShowForm(!showForm)}
            data-testid="add-weight-btn"
          >
            <Plus size={14} />
            Add Entry
          </Button>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-card rounded-2xl p-4 border-2 border-primary/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">New Entry</p>
                <button
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => setShowForm(false)}
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Weight ({units})</label>
                  <Input
                    type="number"
                    placeholder="e.g. 195"
                    value={inputWeight}
                    onChange={(e) => setInputWeight(e.target.value)}
                    className="rounded-xl"
                    data-testid="weight-value-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Date</label>
                  <Input
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    className="rounded-xl"
                    data-testid="weight-date-input"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Notes (optional)</label>
                <Input
                  placeholder="Morning weight, post-workout..."
                  value={inputNotes}
                  onChange={(e) => setInputNotes(e.target.value)}
                  className="rounded-xl"
                  data-testid="weight-notes-input"
                />
              </div>
              <Button className="w-full h-11 rounded-xl font-semibold" onClick={handleAdd} data-testid="save-weight-btn">
                Save Entry
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {displayWeights.map((entry) => (
          <div
            key={entry.id}
            data-testid={`weight-entry-${entry.id}`}
            className="bg-card rounded-2xl p-4 border border-border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {entry.weight} {units}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(entry.date), "EEEE, MMM d")}
                </p>
                {entry.notes && (
                  <p className="text-xs text-muted-foreground italic mt-0.5">{entry.notes}</p>
                )}
              </div>
              <button
                className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"
                onClick={() => handleDeleteWeight(entry.id)}
                data-testid={`delete-weight-${entry.id}`}
              >
                <Trash2 size={14} className="text-destructive" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl p-3.5 shadow-sm border border-border text-center space-y-0.5">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
