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

// ═══════════════════════════════════════════════════════════════
//  MEMBERSHIP FUNCTION FORMULAS
//  Each function maps a crisp input x to a membership degree [0, 1]
// ═══════════════════════════════════════════════════════════════

/**
 * Triangular membership function.
 *   μ(x) = max(0, min((x − a)/(b − a), (c − x)/(c − b)))
 *
 * @param x  - crisp input
 * @param a  - left foot   (μ = 0)
 * @param b  - peak        (μ = 1)
 * @param c  - right foot  (μ = 0)
 */
function trimf(x: number, a: number, b: number, c: number): number {
  if (a === b && b === c) return x === a ? 1 : 0;
  if (a === b) return Math.max(0, Math.min(1, (c - x) / (c - b)));
  if (b === c) return Math.max(0, Math.min(1, (x - a) / (b - a)));
  return Math.max(0, Math.min((x - a) / (b - a), (c - x) / (c - b)));
}

/**
 * Trapezoidal membership function.
 *   μ(x) = max(0, min((x − a)/(b − a), 1, (d − x)/(d − c)))
 *
 * @param x  - crisp input
 * @param a  - left foot      (μ starts rising)
 * @param b  - left shoulder  (μ reaches 1)
 * @param c  - right shoulder (μ starts falling)
 * @param d  - right foot     (μ reaches 0)
 */
function trapmf(x: number, a: number, b: number, c: number, d: number): number {
  const rising  = b === a ? (x >= a ? 1 : 0) : (x - a) / (b - a);
  const falling = d === c ? (x <= c ? 1 : 0) : (d - x) / (d - c);
  return Math.max(0, Math.min(rising, 1, falling));
}

/**
 * Gaussian membership function.
 *   μ(x) = exp(−0.5 · ((x − c) / σ)²)
 *
 * @param x     - crisp input
 * @param c     - center (peak)
 * @param sigma - standard deviation (width)
 */
function gaussmf(x: number, c: number, sigma: number): number {
  return Math.exp(-0.5 * Math.pow((x - c) / sigma, 2));
}

/**
 * Sigmoid membership function (open-ended "high" sets).
 *   μ(x) = 1 / (1 + exp(−a · (x − c)))
 *
 * @param x  - crisp input
 * @param a  - slope (positive = rising sigmoid)
 * @param c  - inflection point (μ = 0.5)
 */
function sigmf(x: number, a: number, c: number): number {
  return 1 / (1 + Math.exp(-a * (x - c)));
}

// ═══════════════════════════════════════════════════════════════
//  FUZZY T-NORM / S-NORM OPERATORS
// ═══════════════════════════════════════════════════════════════

/** Fuzzy AND (T-norm): minimum operator */
const fuzzyAND = (...vals: number[]): number => Math.min(...vals);

/** Fuzzy OR (S-norm): maximum operator */
const fuzzyOR = (...vals: number[]): number => Math.max(...vals);

// ═══════════════════════════════════════════════════════════════
//  INPUT LINGUISTIC VARIABLES  (Fuzzification layer)
//
//  Each variable defines fuzzy sets over its universe of discourse.
//  Parameters are tuned for screen-time monitoring context.
// ═══════════════════════════════════════════════════════════════

/** Screen Time in minutes — Universe: [0, 600+] */
const screenTimeMF = {
  low:    (x: number) => trapmf(x, 0, 0, 60, 120),       // plateau 0–60, falls 60–120
  medium: (x: number) => trapmf(x, 60, 120, 240, 360),   // rises 60–120, plateau 120–240, falls 240–360
  high:   (x: number) => sigmf(x, 0.025, 300),            // sigmoid inflection at 300 min (5 h)
};

/** Distraction Ratio (distracting / total) — Universe: [0, 1] */
const distractionMF = {
  low:    (x: number) => sigmf(x, -20, 0.25),             // inverse sigmoid, inflection 0.25
  medium: (x: number) => gaussmf(x, 0.45, 0.12),         // Gaussian peak at 0.45, σ = 0.12
  high:   (x: number) => sigmf(x, 20, 0.55),              // sigmoid inflection at 0.55
};

/** Session / Pickup Frequency — Universe: [0, 50+] */
const frequencyMF = {
  low:    (x: number) => sigmf(x, -0.4, 10),              // inverse sigmoid, inflection 10
  medium: (x: number) => gaussmf(x, 17, 5),               // Gaussian peak at 17, σ = 5
  high:   (x: number) => sigmf(x, 0.4, 25),               // sigmoid inflection at 25
};

/** Late-Night Usage in minutes — Universe: [0, 120+] */
const lateNightMF = {
  none:  (x: number) => sigmf(x, -0.5, 5),                // inverse sigmoid, inflection 5
  some:  (x: number) => gaussmf(x, 20, 10),               // Gaussian peak at 20, σ = 10
  heavy: (x: number) => sigmf(x, 0.15, 40),               // sigmoid inflection at 40
};

// ═══════════════════════════════════════════════════════════════
//  OUTPUT LINGUISTIC VARIABLE
//
//  Risk score — Universe: [0, 100]
//  Three overlapping fuzzy sets define the output space.
// ═══════════════════════════════════════════════════════════════

const riskOutputMF = {
  healthy:   (x: number) => trapmf(x, 0, 0, 15, 35),
  warning:   (x: number) => trimf(x, 25, 50, 75),
  addictive: (x: number) => trapmf(x, 65, 85, 100, 100),
};

// ═══════════════════════════════════════════════════════════════
//  FUZZY RULE BASE  (Mamdani-style)
//
//  Each rule: IF (antecedent₁ AND antecedent₂ …) THEN consequent
//  Firing strength = T-norm(antecedent membership degrees)
// ═══════════════════════════════════════════════════════════════

interface FuzzyRule {
  /** Returns the firing strength of the rule (0–1) */
  fire: (
    st: number, dr: number, freq: number, ln: number
  ) => number;
  consequent: "healthy" | "warning" | "addictive";
  label: string;
}

const RULES: FuzzyRule[] = [
  // ── Healthy rules ──────────────────────────────────
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

  // ── Warning rules ──────────────────────────────────
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

  // ── Addictive rules ────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════
//  CENTROID DEFUZZIFICATION
//
//  Discretise the output universe [0, 100] into N points.
//  For each point x_i, compute the aggregated membership:
//      μ_agg(x_i) = max over all rules [ min(α_k, μ_Ck(x_i)) ]
//  Then:
//      centroid = Σ(x_i · μ_agg(x_i)) / Σ(μ_agg(x_i))
// ═══════════════════════════════════════════════════════════════

const DEFUZZ_STEPS = 200; // discretisation resolution

interface RuleActivation {
  strength: number;
  consequent: "healthy" | "warning" | "addictive";
}

function centroidDefuzzify(activations: RuleActivation[]): number {
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i <= DEFUZZ_STEPS; i++) {
    const x = (i / DEFUZZ_STEPS) * 100; // universe point [0, 100]

    // Aggregate: for each rule, clip the consequent MF by its firing strength,
    // then take the max across all rules (fuzzy union / S-norm).
    let muAgg = 0;
    for (const act of activations) {
      if (act.strength <= 0) continue;
      const muConsequent = riskOutputMF[act.consequent](x);
      // Mamdani implication: min(α, μ_C(x))
      const clipped = Math.min(act.strength, muConsequent);
      muAgg = Math.max(muAgg, clipped); // S-norm aggregation
    }

    numerator += x * muAgg;
    denominator += muAgg;
  }

  // If no rules fired, return 0 (healthy)
  return denominator > 0 ? numerator / denominator : 0;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN EVALUATION  —  Fuzzify → Infer → Defuzzify
// ═══════════════════════════════════════════════════════════════

export function evaluateUsage(snapshot: UsageSnapshot): {
  riskLevel: RiskLevel;
  score: number;
  details: string[];
} {
  const { totalMinutes, distractingMinutes, sessionCount, lateNightMinutes } = snapshot;

  // ── Step 1: Compute crisp inputs ──
  const distractRatio = totalMinutes > 0 ? distractingMinutes / totalMinutes : 0;

  // ── Step 2: Fire every rule (fuzzification + inference) ──
  const activations: RuleActivation[] = [];
  const triggered: string[] = [];

  for (const rule of RULES) {
    const strength = rule.fire(totalMinutes, distractRatio, sessionCount, lateNightMinutes);

    activations.push({ strength, consequent: rule.consequent });

    // Collect human-readable labels for rules with non-negligible activation
    if (strength > 0.1) {
      triggered.push(rule.label);
    }
  }

  // ── Step 3: Centroid defuzzification ──
  const crispScore = centroidDefuzzify(activations);

  // ── Step 4: Map defuzzified score to a discrete risk level ──
  //   Use the output MFs themselves to determine which set the centroid
  //   belongs to most strongly (maximum membership principle).
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

// ═══════════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS  (unchanged public API)
// ═══════════════════════════════════════════════════════════════

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
