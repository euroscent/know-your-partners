import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// The external schema is installed independently from generated Cloud types.
export const applicantDb = supabase as any;
export interface ApplicantWorkflow {
  user_id: string;
  application_id: string;
  first_name: string;
  last_name: string;
  email: string;
  contract_id: string;
  contract_content: string;
  signed_at: string | null;
  signature_data: string | null;
  company_signature: string | null;
  bank_complete: boolean;
  identity_status: "not_submitted" | "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  id_front_path: string | null;
  id_back_path: string | null;
  active: boolean;
}

export function isActivationComplete(accepted: boolean, signed: boolean, bank: boolean, identity: string): boolean {
  return accepted && signed && bank && identity === "approved";
}

export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const lengths: Record<string, number> = { DE: 22, AT: 20, CH: 21, NL: 18, BE: 16, FR: 27, ES: 24, IT: 27, GB: 22 };
  if (lengths[iban.slice(0, 2)] && iban.length !== lengths[iban.slice(0, 2)]) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export const bankSchema = z.object({
  holder: z.string().trim().min(2).max(150),
  iban: z.string().refine(isValidIban, "IBAN ungültig / Invalid IBAN"),
  bic: z.string().trim().toUpperCase().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/),
});

export async function loadApplicantWorkflows(): Promise<ApplicantWorkflow[]> {
  const { data, error } = await applicantDb.rpc("get_applicant_workflows");
  if (error) throw error;
  return data || [];
}