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

/** Triangular membership function */
function trimf(x: number, a: number, b: number, c: number): number {
  if (a === b && b === c) return x === a ? 1 : 0;
  if (a === b) return Math.max(0, Math.min(1, (c - x) / (c - b)));
  if (b === c) return Math.max(0, Math.min(1, (x - a) / (b - a)));
  return Math.max(0, Math.min((x - a) / (b - a), (c - x) / (c - b)));
}

/** Trapezoidal membership function */
function trapmf(x: number, a: number, b: number, c: number, d: number): number {
  const rising  = b === a ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const falling = d === c ? (x <= c ? 1 : 0) : (d - x) / (d - c);
  return Math.max(0, Math.min(rising, 1, falling));
}

/** Gaussian membership function */
function gaussmf(x: number, c: number, sigma: number): number {
  return Math.exp(-0.5 * Math.pow((x - c) / sigma, 2));
}

/** Sigmoid membership function */
function sigmf(x: number, a: number, c: number): number {
  return 1 / (1 + Math.exp(-a * (x - c)));
}

const fuzzyAND = (...vals: number[]): number => Math.min(...vals);

/** Input Linguistic Variables */
const screenTimeMF = {
  low:    (x: number) => trapmf(x, 0, 0, 60, 120),
  medium: (x: number) => trapmf(x, 60, 120, 240, 360),
  high:   (x: number) => sigmf(x, 0.025, 300),
};

const distractionMF = {
  low:    (x: number) => sigmf(x, -20, 0.25),
  medium: (x: number) => gaussmf(x, 0.45, 0.12),
  high:   (x: number) => sigmf(x, 20, 0.55),
};

const frequencyMF = {
  low:    (x: number) => sigmf(x, -0.4, 10),
  medium: (x: number) => gaussmf(x, 17, 5),
  high:   (x: number) => sigmf(x, 0.4, 25),
};

const lateNightMF = {
  none:  (x: number) => sigmf(x, -0.5, 5),
  some:  (x: number) => gaussmf(x, 20, 10),
  heavy: (x: number) => sigmf(x, 0.15, 40),
};

/** Output Linguistic Variable (Risk Score: 0-100) */
const riskOutputMF = {
  healthy:   (x: number) => trapmf(x, 0, 0, 15, 35),
  warning:   (x: number) => trimf(x, 25, 50, 75),
  addictive: (x: number) => trapmf(x, 65, 85, 100, 100),
};

interface FuzzyRule {
  fire: (st: number, dr: number, freq: number, ln: number) => number;
  consequent: "healthy" | "warning" | "addictive";
  label: string;
}

const RULES: FuzzyRule[] = [
  // Healthy
  {
    fire: (st, dr) => fuzzyAND(screenTimeMF.low(st), distractionMF.low(dr)),
    consequent: "healthy",
    label: "Low usage with low distraction",
  },
  {
    fire: (st, _dr, freq) => fuzzyAND(screenTimeMF.low(st), frequencyMF.low(freq)),
    consequent: "healthy",
    label: "Infrequent, short sessions",
  },
  {
    fire: (st, dr, freq) => fuzzyAND(screenTimeMF.low(st), distractionMF.low(dr), frequencyMF.low(freq)),
    consequent: "healthy",
    label: "Minimal overall device engagement",
  },
  // Warning
  {
    fire: (st, dr) => fuzzyAND(screenTimeMF.medium(st), distractionMF.high(dr)),
    consequent: "warning",
    label: "Moderate time on distracting apps",
  },
  {
    fire: (st, dr) => fuzzyAND(screenTimeMF.high(st), distractionMF.low(dr)),
    consequent: "warning",
    label: "High total screen time (but productive)",
  },
  {
    fire: (st, _dr, freq) => fuzzyAND(screenTimeMF.medium(st), frequencyMF.high(freq)),
    consequent: "warning",
    label: "Frequent phone pickups",
  },
  {
    fire: (st, dr) => fuzzyAND(screenTimeMF.medium(st), distractionMF.medium(dr)),
    consequent: "warning",
    label: "Moderate time with moderate distraction",
  },
  {
    fire: (_st, _dr, _freq, ln) => lateNightMF.some(ln),
    consequent: "warning",
    label: "Some late-night usage detected",
  },
  // Addictive
  {
    fire: (st, dr) => fuzzyAND(screenTimeMF.high(st), distractionMF.high(dr)),
    consequent: "addictive",
    label: "High time on social media / games",
  },
  {
    fire: (st, _dr, freq) => fuzzyAND(screenTimeMF.high(st), frequencyMF.high(freq)),
    consequent: "addictive",
    label: "Very frequent & long usage",
  },
  {
    fire: (st, _dr, _freq, ln) => fuzzyAND(lateNightMF.heavy(ln), screenTimeMF.high(st)),
    consequent: "addictive",
    label: "Late-night heavy screen time",
  },
  {
    fire: (_st, dr, _freq, ln) => fuzzyAND(lateNightMF.heavy(ln), distractionMF.high(dr)),
    consequent: "addictive",
    label: "Late-night social media use",
  },
  {
    fire: (st, dr, freq) => fuzzyAND(screenTimeMF.high(st), distractionMF.high(dr), frequencyMF.high(freq)),
    consequent: "addictive",
    label: "Excessive usage across all dimensions",
  },
];

/** Centroid Defuzzification */
const DEFUZZ_STEPS = 200;

interface RuleActivation {
  strength: number;
  consequent: "healthy" | "warning" | "addictive";
}

function centroidDefuzzify(activations: RuleActivation[]): number {
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i <= DEFUZZ_STEPS; i++) {
    const x = (i / DEFUZZ_STEPS) * 100;
    let muAgg = 0;
    for (const act of activations) {
      if (act.strength <= 0) continue;
      const muConsequent = riskOutputMF[act.consequent](x);
      const clipped = Math.min(act.strength, muConsequent);
      muAgg = Math.max(muAgg, clipped);
    }
    numerator += x * muAgg;
    denominator += muAgg;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

/** Main Evaluation - Fuzzify → Infer → Defuzzify */
export function evaluateUsage(snapshot: UsageSnapshot): {
  riskLevel: RiskLevel;
  score: number;
  details: string[];
} {
  const { totalMinutes, distractingMinutes, sessionCount, lateNightMinutes } = snapshot;
  const distractRatio = totalMinutes > 0 ? distractingMinutes / totalMinutes : 0;

  const activations: RuleActivation[] = [];
  const triggered: string[] = [];

  for (const rule of RULES) {
    const strength = rule.fire(totalMinutes, distractRatio, sessionCount, lateNightMinutes);
    activations.push({ strength, consequent: rule.consequent });
    if (strength > 0.1) {
      triggered.push(rule.label);
    }
  }

  const crispScore = centroidDefuzzify(activations);

  const memberHealthy   = riskOutputMF.healthy(crispScore);
  const memberWarning   = riskOutputMF.warning(crispScore);
  const memberAddictive = riskOutputMF.addictive(crispScore);

  let riskLevel: RiskLevel;
  if (memberAddictive >= memberWarning && memberAddictive >= memberHealthy) {
    riskLevel = "addictive";
  } else if (memberWarning >= memberHealthy) {
    riskLevel = "warning";
  } else {
    riskLevel = "healthy";
  }

  return {
    riskLevel,
    score: Math.round(crispScore),
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
  "Maps": "neutral",
  "Spotify": "neutral",
  "Podcasts": "neutral",
  "Safari": "neutral",
  "Chrome": "neutral",
  "Messages": "neutral",
  "Photos": "neutral",
  "Weather": "neutral",
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
