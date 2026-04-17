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

// ── Membership functions ─────────────────────────────────────────
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const trapmf = (x: number, a: number, b: number, c: number, d: number) =>
  clamp(Math.min(b === a ? (x >= a ? 1 : 0) : (x - a) / (b - a), 1, d === c ? (x <= c ? 1 : 0) : (d - x) / (d - c)));
const trimf  = (x: number, a: number, b: number, c: number) =>
  clamp(Math.min((x - a) / (b - a), (c - x) / (c - b)));
const gaussmf = (x: number, c: number, s: number) =>
  Math.exp(-0.5 * ((x - c) / s) ** 2);
const sigmf  = (x: number, a: number, c: number) =>
  1 / (1 + Math.exp(-a * (x - c)));
const and    = Math.min;

// ── Pre-computed output centroid values ──────────────────────────
// Analytical centroid of each output fuzzy set avoids the 200-step loop.
// healthy  = trapmf(0,0,15,35)  → centroid ≈  8.33
// warning  = trimf(25,50,75)    → centroid = 50
// addictive = trapmf(65,85,100,100) → centroid ≈ 91.67
const OUT_CENTROID: Record<RiskLevel, number> = {
  healthy:   8.33,
  warning:  50.00,
  addictive: 91.67,
};

// ── Fuzzify all inputs in one pass ───────────────────────────────
interface Fuzz {
  stL: number; stM: number; stH: number;
  drL: number; drM: number; drH: number;
  frL: number; frH: number;
  lnS: number; lnHv: number;
}
function fuzzify(st: number, dr: number, freq: number, ln: number): Fuzz {
  return {
    stL: trapmf(st, 0, 0, 60, 120),  stM: trapmf(st, 60, 120, 240, 360),  stH: sigmf(st, 0.025, 300),
    drL: sigmf(dr, -20, 0.25),        drM: gaussmf(dr, 0.45, 0.12),          drH: sigmf(dr, 20, 0.55),
    frL: sigmf(freq, -0.4, 10),                                               frH: sigmf(freq, 0.4, 25),
    lnS: gaussmf(ln, 20, 10),         lnHv: sigmf(ln, 0.15, 40),
  };
}

// ── Rule base: [strength-fn, consequent] ────────────────────────
// Returns firing strength directly from pre-computed Fuzz object.
type RuleEntry = [(f: Fuzz) => number, RiskLevel, string];
const RULES: RuleEntry[] = [
  // Healthy
  [f => and(f.stL, f.drL),           "healthy",   "Low usage with low distraction"],
  [f => and(f.stL, f.frL),           "healthy",   "Infrequent, short sessions"],
  // Warning
  [f => and(f.stM, f.drH),           "warning",   "Moderate time on distracting apps"],
  [f => and(f.stH, f.drL),           "warning",   "High screen time (but productive)"],
  [f => and(f.stM, f.frH),           "warning",   "Frequent phone pickups"],
  [f => and(f.stM, f.drM),           "warning",   "Moderate time & distraction"],
  [f => f.lnS,                        "warning",   "Some late-night usage"],
  // Addictive
  [f => and(f.stH, f.drH),           "addictive", "High time on social media / games"],
  [f => and(f.stH, f.frH),           "addictive", "Very frequent & long usage"],
  [f => and(f.lnHv, f.stH),         "addictive", "Late-night heavy screen time"],
  [f => and(f.lnHv, f.drH),         "addictive", "Late-night social media use"],
  [f => and(f.stH, f.drH, f.frH),   "addictive", "Excessive usage across all dimensions"],
];

// ── Defuzzification: weighted centroid (O(R) instead of O(R×N)) ─
function defuzzify(strengths: [number, RiskLevel][]): number {
  let num = 0, den = 0;
  // Aggregate max strength per output set, then use analytical centroid
  const maxS: Record<RiskLevel, number> = { healthy: 0, warning: 0, addictive: 0 };
  for (const [s, c] of strengths) if (s > maxS[c]) maxS[c] = s;
  for (const level of ["healthy", "warning", "addictive"] as RiskLevel[]) {
    const s = maxS[level];
    if (s > 0) { num += s * OUT_CENTROID[level]; den += s; }
  }
  return den > 0 ? num / den : 0;
}

// ── Main evaluation ──────────────────────────────────────────────
export function evaluateUsage(snapshot: UsageSnapshot): {
  riskLevel: RiskLevel; score: number; details: string[];
} {
  const { totalMinutes, distractingMinutes, sessionCount, lateNightMinutes } = snapshot;
  const dr = totalMinutes > 0 ? distractingMinutes / totalMinutes : 0;
  const f  = fuzzify(totalMinutes, dr, sessionCount, lateNightMinutes);

  const strengths: [number, RiskLevel][] = [];
  const triggered: string[] = [];

  for (const [fire, consequent, label] of RULES) {
    const s = fire(f);
    strengths.push([s, consequent]);
    if (s > 0.1) triggered.push(label);
  }

  const score = defuzzify(strengths);

  // Maximum membership principle for risk label
  const mH = trapmf(score, 0, 0, 15, 35);
  const mW = trimf(score, 25, 50, 75);
  const mA = trapmf(score, 65, 85, 100, 100);
  const riskLevel: RiskLevel =
    mA >= mW && mA >= mH ? "addictive" : mW >= mH ? "warning" : "healthy";

  return { riskLevel, score: Math.round(score), details: triggered.slice(0, 3) };
}

// ── Utilities ────────────────────────────────────────────────────
export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 5)  return "late_night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return h < 24 ? "night" : "late_night";
}

export const isLateNight = (): boolean => {
  const h = new Date().getHours();
  return h >= 22 || h < 5;
};

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const m = minutes % 60;
  return m > 0 ? `${Math.floor(minutes / 60)}h ${m}m` : `${Math.floor(minutes / 60)}h`;
}

export const APP_CATEGORIES: Record<string, AppCategory> = {
  Notion: "productive", Notes: "productive", Duolingo: "productive",
  "Khan Academy": "productive", Calendar: "productive", Anki: "productive",
  Coursera: "productive", GitHub: "productive", Slack: "productive",
  Zoom: "productive", Gmail: "productive", LinkedIn: "productive",
  Maps: "neutral", Spotify: "neutral", Podcasts: "neutral",
  Safari: "neutral", Chrome: "neutral", Messages: "neutral",
  Photos: "neutral", Weather: "neutral",
  Instagram: "distracting", TikTok: "distracting", YouTube: "distracting",
  Twitter: "distracting", Snapchat: "distracting", Reddit: "distracting",
  Facebook: "distracting", PUBG: "distracting", Fortnite: "distracting",
  Games: "distracting", Netflix: "distracting", Roblox: "distracting",
};

export const PREDEFINED_APPS = Object.keys(APP_CATEGORIES);
