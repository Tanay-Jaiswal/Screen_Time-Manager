export type AppCategory = "productive" | "neutral" | "distracting";
export type RiskLevel = "healthy" | "warning" | "addictive";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night" | "late_night";

export interface UsageSnapshot {
  totalMinutes: number;
  productiveMinutes: number;
  neutralMinutes: number;
  distractingMinutes: number;
  sessionCount: number;
  lateNightMinutes: number;
}

// Membership functions (0-1 scale)
function lowTime(minutes: number): number {
  if (minutes <= 60) return 1;
  if (minutes <= 120) return (120 - minutes) / 60;
  return 0;
}

function mediumTime(minutes: number): number {
  if (minutes <= 60) return 0;
  if (minutes <= 120) return (minutes - 60) / 60;
  if (minutes <= 240) return 1;
  if (minutes <= 360) return (360 - minutes) / 120;
  return 0;
}

function highTime(minutes: number): number {
  if (minutes <= 240) return 0;
  if (minutes <= 360) return (minutes - 240) / 120;
  return 1;
}

function lowDistraction(ratio: number): number {
  if (ratio <= 0.2) return 1;
  if (ratio <= 0.5) return (0.5 - ratio) / 0.3;
  return 0;
}

function highDistraction(ratio: number): number {
  if (ratio <= 0.4) return 0;
  if (ratio <= 0.6) return (ratio - 0.4) / 0.2;
  return 1;
}

function lowFrequency(count: number): number {
  if (count <= 10) return 1;
  if (count <= 20) return (20 - count) / 10;
  return 0;
}

function highFrequency(count: number): number {
  if (count <= 15) return 0;
  if (count <= 25) return (count - 15) / 10;
  return 1;
}

function lateNightFactor(lateNightMinutes: number): number {
  if (lateNightMinutes <= 0) return 0;
  if (lateNightMinutes <= 30) return lateNightMinutes / 30;
  return 1;
}

export function evaluateUsage(snapshot: UsageSnapshot): {
  riskLevel: RiskLevel;
  score: number;
  details: string[];
} {
  const { totalMinutes, distractingMinutes, sessionCount, lateNightMinutes } = snapshot;

  const distractRatio =
    totalMinutes > 0 ? distractingMinutes / totalMinutes : 0;

  // Fuzzy rule evaluation
  const rules: { weight: number; target: "healthy" | "warning" | "addictive"; label: string }[] = [
    // Healthy rules
    {
      weight: Math.min(lowTime(totalMinutes), lowDistraction(distractRatio)) * 1.0,
      target: "healthy",
      label: "Low usage with low distraction",
    },
    {
      weight: Math.min(lowTime(totalMinutes), lowFrequency(sessionCount)) * 0.9,
      target: "healthy",
      label: "Infrequent, short sessions",
    },
    // Warning rules
    {
      weight: Math.min(mediumTime(totalMinutes), highDistraction(distractRatio)) * 0.85,
      target: "warning",
      label: "Moderate time on distracting apps",
    },
    {
      weight: Math.min(highTime(totalMinutes), lowDistraction(distractRatio)) * 0.7,
      target: "warning",
      label: "High total screen time",
    },
    {
      weight: Math.min(mediumTime(totalMinutes), highFrequency(sessionCount)) * 0.75,
      target: "warning",
      label: "Frequent phone pickups",
    },
    // Addictive rules
    {
      weight: Math.min(highTime(totalMinutes), highDistraction(distractRatio)) * 1.0,
      target: "addictive",
      label: "High time on social media/games",
    },
    {
      weight: Math.min(highTime(totalMinutes), highFrequency(sessionCount)) * 0.9,
      target: "addictive",
      label: "Very frequent & long usage",
    },
    {
      weight: Math.min(lateNightFactor(lateNightMinutes), highTime(totalMinutes)) * 0.95,
      target: "addictive",
      label: "Late-night heavy screen time",
    },
    {
      weight: Math.min(lateNightFactor(lateNightMinutes), highDistraction(distractRatio)) * 0.8,
      target: "addictive",
      label: "Late-night social media use",
    },
    {
      weight: Math.min(lateNightFactor(lateNightMinutes), 0.5) * 0.6,
      target: "warning",
      label: "Any late-night usage detected",
    },
  ];

  let healthyScore = 0;
  let warningScore = 0;
  let addictiveScore = 0;
  const triggered: string[] = [];

  for (const rule of rules) {
    if (rule.weight > 0.15) {
      triggered.push(rule.label);
    }
    if (rule.target === "healthy") healthyScore = Math.max(healthyScore, rule.weight);
    if (rule.target === "warning") warningScore = Math.max(warningScore, rule.weight);
    if (rule.target === "addictive") addictiveScore = Math.max(addictiveScore, rule.weight);
  }

  // Defuzzification
  const total = healthyScore + warningScore + addictiveScore || 1;
  const score =
    (healthyScore * 0 + warningScore * 50 + addictiveScore * 100) / total;

  let riskLevel: RiskLevel = "healthy";
  if (addictiveScore > 0.5) {
    riskLevel = "addictive";
  } else if (warningScore > 0.4 || addictiveScore > 0.2) {
    riskLevel = "warning";
  } else {
    riskLevel = "healthy";
  }

  return {
    riskLevel,
    score: Math.round(score),
    details: triggered.slice(0, 3),
  };
}

export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  if (hour >= 21 && hour < 24) return "night";
  return "late_night";
}

export function isLateNight(): boolean {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 5;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export const APP_CATEGORIES: Record<string, AppCategory> = {
  // Productive
  "Notion": "productive",
  "Notes": "productive",
  "Duolingo": "productive",
  "Khan Academy": "productive",
  "Calendar": "productive",
  "Anki": "productive",
  "Coursera": "productive",
  "GitHub": "productive",
  "Slack": "productive",
  "Zoom": "productive",
  "Gmail": "productive",
  "LinkedIn": "productive",
  // Neutral
  "Maps": "neutral",
  "Spotify": "neutral",
  "Podcasts": "neutral",
  "Safari": "neutral",
  "Chrome": "neutral",
  "Messages": "neutral",
  "Photos": "neutral",
  "Weather": "neutral",
  // Distracting
  "Instagram": "distracting",
  "TikTok": "distracting",
  "YouTube": "distracting",
  "Twitter": "distracting",
  "Snapchat": "distracting",
  "Reddit": "distracting",
  "Facebook": "distracting",
  "PUBG": "distracting",
  "Fortnite": "distracting",
  "Games": "distracting",
  "Netflix": "distracting",
  "Roblox": "distracting",
};

export const PREDEFINED_APPS = Object.keys(APP_CATEGORIES);
