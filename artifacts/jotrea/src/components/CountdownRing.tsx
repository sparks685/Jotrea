import { motion } from "framer-motion";

interface CountdownRingProps {
  daysUntil: number;
  intervalDays: number;
  size?: number;
}

export function CountdownRing({ daysUntil, intervalDays, size = 160 }: CountdownRingProps) {
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = intervalDays > 0 ? Math.max(0, 1 - daysUntil / intervalDays) : 1;
  const strokeDashoffset = circumference * (1 - progress);
  const isDueToday = daysUntil === 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={10}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={isDueToday ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        {isDueToday ? (
          <>
            <span className="text-xs font-medium text-primary uppercase tracking-wide">Due</span>
            <span className="text-3xl font-bold text-primary">Today</span>
          </>
        ) : (
          <>
            <span className="text-4xl font-bold text-foreground">{daysUntil}</span>
            <span className="text-xs font-medium text-muted-foreground mt-0.5">
              {daysUntil === 1 ? "day" : "days"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
