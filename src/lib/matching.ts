// Project matching logic for the onboarding questionnaire.
// Computes a 0–100 % match score between an employee profile and a task.

export const INDUSTRIES = [
  "Payment",
  "Travel",
  "Banking",
  "Crypto",
  "E-Commerce",
  "Insurance",
  "Lending",
  "Marketplaces",
] as const;

export type Industry = (typeof INDUSTRIES)[number];

export const ACTIVITIES = [
  "Kundenservice",
  "Vertrieb",
  "Telefonie",
  "Chat-Support",
  "E-Mail-Support",
  "Backoffice",
  "Datenpflege",
  "Reklamationsbearbeitung",
  "Betrugsprävention",
  "KYC / Identitätsprüfung",
  "Sales",
  "Technischer Support",
  "Social Media Support",
] as const;

export const TASK_AFFINITIES = [
  "Kunden beraten",
  "Probleme lösen",
  "Verkaufen",
  "Organisieren",
  "Analysieren",
  "Daten bearbeiten",
  "Prozesse optimieren",
  "Menschen helfen",
] as const;

export const CHANNELS = ["Telefon", "Chat", "E-Mail", "Video", "Mischung aus allem"] as const;
export const SHIFTS = ["Frühschicht", "Tagschicht", "Spätschicht", "Nachtschicht", "Flexibel"] as const;
export const HOURS = ["Minijob", "Teilzeit", "Vollzeit", "Flexibel"] as const;
export const LANGUAGE_LEVELS = ["Muttersprache", "C2", "C1", "B2", "B1"] as const;
export const EQUIPMENT = [
  "Windows-PC vorhanden",
  "Mac vorhanden",
  "Zweiter Monitor",
  "Headset",
  "Stabile Internetverbindung",
  "Ruhiger Arbeitsplatz",
] as const;
export const CAREER_GOALS = [
  "Teamleitung",
  "Quality Management",
  "Training",
  "Kundenservice",
  "Vertrieb",
  "Projektmanagement",
  "Egal – Hauptsache interessante Projekte",
] as const;

export const EXPERIENCE_LEVELS = ["Anfänger", "Fortgeschritten", "Experte"] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export interface QuestionnaireData {
  interests: string[];
  top_interests: string[];
  experience: Record<string, ExperienceLevel>;
  preferred_activities: string[];
  task_preferences: {
    affinities?: string[];
    channel?: string;
    shift?: string;
    hours?: string;
  };
  languages: Array<{ language: string; level: string }>;
  motivation_text?: string;
  interest_topics?: string;
  avoid_topics?: string;
  equipment: string[];
  career_goals: string[];
}

export interface MatchableTask {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  tags?: string[] | null;
}

// Keyword map: which words in title/description/tags hint at which industry.
const INDUSTRY_KEYWORDS: Record<Industry, string[]> = {
  Payment: ["payment", "paypal", "klarna", "stripe", "zahlung", "kasse", "wallet"],
  Travel: ["travel", "reise", "booking", "flug", "hotel", "airbnb", "lufthansa"],
  Banking: ["bank", "konto", "iban", "sparkasse", "commerzbank", "norisbank", "qonto", "n26", "revolut", "bankdrop"],
  Crypto: ["crypto", "bitcoin", "btc", "eth", "binance", "coinbase", "kraken", "wallet", "exchanger"],
  "E-Commerce": ["shop", "amazon", "ebay", "otto", "zalando", "lidl", "aldi", "kaufland", "commerce"],
  Insurance: ["insurance", "versicherung", "allianz", "axa"],
  Lending: ["lending", "kredit", "loan", "smava", "auxmoney"],
  Marketplaces: ["marketplace", "marktplatz", "ebay", "kleinanzeigen", "vinted"],
};

function detectIndustries(task: MatchableTask): Industry[] {
  const hay = [
    task.title ?? "",
    task.description ?? "",
    task.category ?? "",
    ...(task.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const found = new Set<Industry>();
  for (const ind of INDUSTRIES) {
    const kws = INDUSTRY_KEYWORDS[ind];
    if (kws.some((kw) => hay.includes(kw))) found.add(ind);
    if (hay.includes(ind.toLowerCase())) found.add(ind);
  }
  // Category fallbacks
  if (task.category?.toLowerCase() === "bankdrop") found.add("Banking");
  if (task.category?.toLowerCase() === "exchanger") found.add("Crypto");
  return Array.from(found);
}

const EXPERIENCE_WEIGHT: Record<ExperienceLevel, number> = {
  Anfänger: 0.4,
  Fortgeschritten: 0.7,
  Experte: 1,
};

/**
 * Returns match score 0–100.
 */
export function calculateMatchScore(q: QuestionnaireData, task: MatchableTask): number {
  const industries = detectIndustries(task);

  // 1. Interests (40 %) — top-3 weighted stronger
  let interestScore = 0;
  if (industries.length === 0) {
    interestScore = 0.5; // neutral when no industry info on task
  } else {
    let hits = 0;
    for (const ind of industries) {
      const topIdx = q.top_interests.indexOf(ind);
      if (topIdx === 0) hits += 1;
      else if (topIdx === 1) hits += 0.85;
      else if (topIdx === 2) hits += 0.7;
      else if (q.interests.includes(ind)) hits += 0.5;
    }
    interestScore = Math.min(1, hits / industries.length);
  }

  // 2. Experience (25 %)
  let expScore = 0;
  if (industries.length === 0) {
    expScore = 0.5;
  } else {
    const levels = industries
      .map((i) => q.experience[i])
      .filter((l): l is ExperienceLevel => !!l)
      .map((l) => EXPERIENCE_WEIGHT[l]);
    expScore = levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / industries.length : 0.15;
  }

  // 3. Preferred activities (15 %) — match against task title/description keywords
  const hay = `${task.title} ${task.description ?? ""}`.toLowerCase();
  let actHits = 0;
  for (const act of q.preferred_activities) {
    const key = act.toLowerCase().split(/[\s/]+/)[0];
    if (key && hay.includes(key)) actHits += 1;
  }
  const actScore = q.preferred_activities.length > 0
    ? Math.min(1, 0.4 + actHits * 0.2)
    : 0.5;

  // 4. Shift / hours (10 %)
  const shiftScore = q.task_preferences.shift === "Flexibel" ? 1 : 0.8;

  // 5. Languages (10 %) — assume German required, bonus for additional fluent languages
  const hasGerman = q.languages.some(
    (l) => /deutsch|german/i.test(l.language) && ["Muttersprache", "C2", "C1"].includes(l.level)
  );
  const langScore = hasGerman ? 1 : q.languages.length > 0 ? 0.6 : 0.4;

  const total =
    interestScore * 40 + expScore * 25 + actScore * 15 + shiftScore * 10 + langScore * 10;

  return Math.round(Math.max(0, Math.min(100, total)));
}

export function describeMatch(q: QuestionnaireData): string {
  const top = q.top_interests.length > 0 ? q.top_interests : q.interests.slice(0, 3);
  if (top.length === 0) {
    return "Wir suchen passende Projekte basierend auf deinen Antworten.";
  }
  return `Basierend auf deinen Interessen und Erfahrungen passen besonders gut zu dir: ${top.join(
    ", "
  )}. Wir priorisieren künftig Projekte aus diesen Bereichen für dich.`;
}
