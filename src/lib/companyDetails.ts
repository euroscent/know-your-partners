export const COMPANY_DETAILS = {
  company_name: "EuroScent GmbH",
  street_address: "Königsallee 89",
  postal_code: "40212",
  city: "Düsseldorf",
  managing_director: "Rolf Erwin Ruhfus",
  register_court: "Amtsgericht Düsseldorf",
  trade_register_number: "HRB 69139",
  vat_id: "DE152885038",
  main_email: "office@euroscent.de",
} as const;

/** Retire imported legacy identity without overwriting unrelated company settings. */
export function currentCompanyDetails<T extends object>(data: T) {
  return { ...data, ...COMPANY_DETAILS };
}