// Hilfsfunktionen zur Berechnung der vom Mitarbeiter beanspruchten Boni
// (z. B. postalische Zusendung, Ausweisdokument-Bonus). Werden im Review
// vom Admin freigegeben und mit der Honorarabrechnung gespeichert.

export interface BonusItem {
  id: string;
  label: string;
  amount: number;
  source: "postal_consent" | "id_document";
  step_id: string;
}

interface AnyStep {
  id: string;
  title?: string;
  ask_postal_consent?: boolean;
  postal_consent_bonus?: number;
  ask_id_document?: boolean;
  id_document_bonus?: { personalausweis?: number; reisepass?: number };
  [k: string]: any;
}

interface AnyResponse {
  step_id?: string;
  postal_consent?: "yes" | "no";
  id_document?: string;
  [k: string]: any;
}

const ID_DOC_LABEL: Record<string, string> = {
  personalausweis: "Personalausweis",
  reisepass: "Reisepass",
};

/**
 * Ermittelt alle Boni, die der Mitarbeiter in den Step-Antworten
 * beansprucht hat (basierend auf den Step-Konfigurationen).
 */
export function computeAvailableBonuses(
  steps: AnyStep[] | null | undefined,
  stepResponses: AnyResponse[] | Record<string, AnyResponse> | null | undefined,
): BonusItem[] {
  if (!Array.isArray(steps) || steps.length === 0) return [];

  const responses: AnyResponse[] = Array.isArray(stepResponses)
    ? stepResponses
    : stepResponses && typeof stepResponses === "object"
      ? Object.values(stepResponses)
      : [];

  const result: BonusItem[] = [];

  for (const step of steps) {
    if (!step?.id) continue;
    const stepTitle = step.title || "Schritt";
    const resp = responses.find((r) => r?.step_id === step.id);

    // Postalische Zusendung
    if (step.ask_postal_consent) {
      const accepted = resp?.postal_consent === "yes";
      const bonus = Number(step.postal_consent_bonus ?? 0);
      if (accepted && bonus > 0) {
        result.push({
          id: `postal_${step.id}`,
          label: `Postalische Zusendung – ${stepTitle}`,
          amount: bonus,
          source: "postal_consent",
          step_id: step.id,
        });
      }
    }

    // Ausweisdokument-Bonus
    if (step.ask_id_document && resp?.id_document) {
      const sel = resp.id_document as "personalausweis" | "reisepass";
      const bonus = Number(step.id_document_bonus?.[sel] ?? 0);
      if (bonus > 0) {
        result.push({
          id: `iddoc_${step.id}`,
          label: `Ausweisdokument: ${ID_DOC_LABEL[sel] ?? sel} – ${stepTitle}`,
          amount: bonus,
          source: "id_document",
          step_id: step.id,
        });
      }
    }
  }

  return result;
}

export const formatEuro = (amount: number) =>
  amount.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + " €";
