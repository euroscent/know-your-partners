import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  employment_type: string | null;
  tax_class: number | null;
  health_insurance: string | null;
  marital_status: string | null;
  federal_state: string | null;
  children_count: number | null;
}

function calculateAutomaticDeductions(
  grossSalary: number,
  employmentType: string | null,
  taxClass: number | null,
  healthInsurance: string | null,
  maritalStatus: string | null,
  federalState: string | null,
  childrenCount: number | null,
): {
  taxDeduction: number;
  solidaritySurcharge: number;
  churchTax: number;
  healthInsuranceAmount: number;
  pensionInsurance: number;
  unemploymentInsurance: number;
  nursingCareInsurance: number;
} {
  let taxDeduction = 0;
  let solidaritySurcharge = 0;
  let churchTax = 0;
  let healthInsuranceAmount = 0;
  let pensionInsurance = 0;
  let unemploymentInsurance = 0;
  let nursingCareInsurance = 0;

  const empType = employmentType?.toLowerCase() || "";

  const HEALTH_INSURANCE_RATE = 0.073;
  const PENSION_INSURANCE_RATE = 0.093;
  const UNEMPLOYMENT_RATE = 0.012;
  const NURSING_CARE_RATE = 0.01525;
  const CHURCH_TAX_RATE = 0.09;
  const SOLIDARITY_RATE = 0.055;

  if (empType === "vollzeit" || empType === "teilzeit" || empType === "employee") {
    const effectiveTaxClass = taxClass || 1;

    switch (effectiveTaxClass) {
      case 1:
        taxDeduction = grossSalary * 0.2;
        break;
      case 2:
        taxDeduction = grossSalary * 0.15 - (childrenCount || 0) * 100;
        break;
      case 3:
        taxDeduction = grossSalary * 0.1;
        break;
      case 4:
        taxDeduction = grossSalary * 0.18;
        break;
      case 5:
        taxDeduction = grossSalary * 0.28;
        break;
      case 6:
        taxDeduction = grossSalary * 0.4;
        break;
      default:
        taxDeduction = grossSalary * 0.2;
    }
    if (taxDeduction < 0) taxDeduction = 0;

    solidaritySurcharge = taxDeduction * SOLIDARITY_RATE;
    churchTax = taxDeduction * CHURCH_TAX_RATE;

    healthInsuranceAmount = grossSalary * HEALTH_INSURANCE_RATE;
    pensionInsurance = grossSalary * PENSION_INSURANCE_RATE;
    unemploymentInsurance = grossSalary * UNEMPLOYMENT_RATE;
    nursingCareInsurance = grossSalary * NURSING_CARE_RATE;
  } else if (empType === "minijob") {
    taxDeduction = grossSalary * 0.02;
    solidaritySurcharge = 0;
    churchTax = 0;
    healthInsuranceAmount = 0;
    pensionInsurance = 0;
    unemploymentInsurance = 0;
    nursingCareInsurance = 0;
  } else if (empType === "werkstudent") {
    taxDeduction = 0;
    solidaritySurcharge = 0;
    churchTax = 0;
    healthInsuranceAmount = 0;
    pensionInsurance = grossSalary * PENSION_INSURANCE_RATE;
    unemploymentInsurance = grossSalary * UNEMPLOYMENT_RATE;
    nursingCareInsurance = 0;
  }

  return {
    taxDeduction: Math.round(taxDeduction * 100) / 100,
    solidaritySurcharge: Math.round(solidaritySurcharge * 100) / 100,
    churchTax: Math.round(churchTax * 100) / 100,
    healthInsuranceAmount: Math.round(healthInsuranceAmount * 100) / 100,
    pensionInsurance: Math.round(pensionInsurance * 100) / 100,
    unemploymentInsurance: Math.round(unemploymentInsurance * 100) / 100,
    nursingCareInsurance: Math.round(nursingCareInsurance * 100) / 100,
  };
}

function extractSalaryFromContract(content: string | null): number | null {
  if (!content) return null;
  const patterns = [
    /(?:Bruttogehalt|Gehalt|Vergütung).*?(\d{1,5}(?:[.,]\d{2,3})?)\s*(?:EUR|€|Euro)/i,
    /(\d{1,5}(?:[.,]\d{2,3})?)\s*(?:EUR|€|Euro).*?(?:monatlich|pro Monat|brutto)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const salaryStr = match[1].replace(/\./g, "").replace(",", ".");
      const salary = parseFloat(salaryStr);
      if (salary >= 100 && salary < 100000) return salary;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentYear = previousMonth.getFullYear();
    const currentMonth = previousMonth.getMonth() + 1;

    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("*").eq("verified", true);

    if (profilesError) throw profilesError;
    if (!profiles || profiles.length === 0)
      return new Response(JSON.stringify({ message: "No verified employees found", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    const payrollEntries = [];
    const errors = [];

    for (const profile of profiles as Profile[]) {
      try {
        const { data: contractDoc } = await supabase
          .from("employee_documents")
          .select("start_date, content")
          .eq("user_id", profile.id)
          .eq("document_type", "contract")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const startDate = contractDoc?.start_date ? new Date(contractDoc.start_date) : null;

        if (
          startDate &&
          (currentYear < startDate.getFullYear() ||
            (currentYear === startDate.getFullYear() && currentMonth < startDate.getMonth() + 1))
        ) {
          continue;
        }

        const contractSalary = extractSalaryFromContract(contractDoc?.content);
        let fullMonthGrossSalary = 0;
        let fullMonthWorkingHours = 0;
        let hourlyRate = 0;

        const employmentType = profile.employment_type?.toLowerCase() || "";
        switch (employmentType) {
          case "vollzeit":
          case "employee":
            fullMonthGrossSalary = contractSalary || 3890;
            fullMonthWorkingHours = 152;
            break;
          case "teilzeit":
            fullMonthGrossSalary = contractSalary || 2560;
            fullMonthWorkingHours = 80;
            break;
          case "minijob":
            fullMonthGrossSalary = contractSalary || 603;
            fullMonthWorkingHours = 40;
            break;
          case "werkstudent":
            fullMonthGrossSalary = contractSalary || 1000;
            fullMonthWorkingHours = 80;
            break;
          default:
            continue;
        }

        hourlyRate = fullMonthGrossSalary / fullMonthWorkingHours;

        let grossSalary = fullMonthGrossSalary;
        let workingHours = fullMonthWorkingHours;
        let proRataNote = "";

        if (startDate && startDate.getFullYear() === currentYear && startDate.getMonth() + 1 === currentMonth) {
          const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          const startDay = startDate.getDate();
          const workedDays = daysInMonth - startDay + 1;
          grossSalary = (fullMonthGrossSalary / daysInMonth) * workedDays;
          workingHours = (fullMonthWorkingHours / daysInMonth) * workedDays;
          proRataNote = ` (anteilig, Arbeitsbeginn: ${startDay}.${currentMonth}.${currentYear}, ${workedDays}/${daysInMonth} Tage)`;
        }

        const deductions = calculateAutomaticDeductions(
          grossSalary,
          profile.employment_type,
          profile.tax_class,
          profile.health_insurance,
          profile.marital_status,
          profile.federal_state,
          profile.children_count,
        );

        const netSalary =
          employmentType === "minijob"
            ? grossSalary
            : grossSalary -
              (deductions.taxDeduction +
                deductions.solidaritySurcharge +
                deductions.churchTax +
                deductions.healthInsuranceAmount +
                deductions.pensionInsurance +
                deductions.unemploymentInsurance +
                deductions.nursingCareInsurance);

        let paymentDate = new Date(currentYear, currentMonth - 1 + 1, 0);
        const dayOfWeek = paymentDate.getDay();
        if (dayOfWeek === 6) paymentDate.setDate(paymentDate.getDate() - 1);
        else if (dayOfWeek === 0) paymentDate.setDate(paymentDate.getDate() - 2);
        const paymentDateString = paymentDate.toISOString().split("T")[0];

        const { data: payroll, error: payrollError } = await supabase
          .from("payroll")
          .upsert(
            {
              user_id: profile.id,
              year: currentYear,
              month: currentMonth,
              gross_salary: grossSalary,
              tax_deduction: deductions.taxDeduction,
              solidarity_surcharge: deductions.solidaritySurcharge,
              church_tax: deductions.churchTax,
              health_insurance: deductions.healthInsuranceAmount,
              pension_insurance: deductions.pensionInsurance,
              unemployment_insurance: deductions.unemploymentInsurance,
              nursing_care_insurance: deductions.nursingCareInsurance,
              other_deductions: 0,
              net_salary: netSalary,
              working_hours: workingHours,
              hourly_rate: hourlyRate,
              payment_date: paymentDateString,
              notes: "Automatisch generiert" + proRataNote,
            },
            { onConflict: "user_id,month,year" },
          )
          .select()
          .single();

        if (payrollError) errors.push({ email: profile.email, error: payrollError.message });
        else payrollEntries.push(payroll);
      } catch (error) {
        errors.push({ email: profile.email, error: String(error) });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Monatliche Lohnabrechnung abgeschlossen",
        created: payrollEntries.length,
        errors: errors.length,
        details: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
