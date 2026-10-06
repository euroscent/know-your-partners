export type ContractCategory = "Minijob" | "Teilzeit" | "Vollzeit" | "Freelancer";

export function normalizeContractCategory(input: string | null | undefined): ContractCategory | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  const s = raw.toLowerCase();

  // Accept both slugs and labels and also full titles like "Arbeitsvertrag - Minijob"
  if (s.includes("minijob") || s.includes("mini job")) return "Minijob";
  if (s.includes("teilzeit") || s.includes("teil zeit") || s.includes("part")) return "Teilzeit";
  if (s.includes("vollzeit") || s.includes("voll zeit") || s.includes("full")) return "Vollzeit";
  if (s.includes("freelancer") || s.includes("free")) return "Freelancer";

  return null;
}
