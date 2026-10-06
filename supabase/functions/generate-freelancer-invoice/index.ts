import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BonusItem {
  id: string;
  label: string;
  amount: number;
}

interface RequestBody {
  submission_id: string;
  hours_worked?: number;
  bonus_amount?: number;
  bonus_breakdown?: BonusItem[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { submission_id, hours_worked, bonus_amount, bonus_breakdown }: RequestBody = await req.json();

    if (!submission_id) {
      return new Response(
        JSON.stringify({ error: "submission_id is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Hole Submission mit Task und User
    const { data: submission, error: submissionError } = await supabase
      .from("task_submissions")
      .select(`
        id,
        task_id,
        employee_id,
        status,
        tasks (
          id,
          title,
          compensation_amount,
          estimated_hours
        )
      `)
      .eq("id", submission_id)
      .single();

    if (submissionError || !submission) {
      return new Response(
        JSON.stringify({ error: "Submission not found", details: submissionError?.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Prüfe ob User Freelancer ist
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("employment_type, first_name, last_name")
      .eq("id", submission.employee_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    const employmentType = profile.employment_type?.toLowerCase() || "";
    if (employmentType !== "freelancer") {
      return new Response(
        JSON.stringify({ 
          message: "User is not a freelancer, skipping invoice generation",
          employment_type: employmentType 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Prüfe ob bereits eine Rechnung existiert
    const { data: existingInvoice } = await supabase
      .from("freelancer_invoices")
      .select("id")
      .eq("submission_id", submission_id)
      .maybeSingle();

    if (existingInvoice) {
      return new Response(
        JSON.stringify({ 
          message: "Invoice already exists for this submission",
          invoice_id: existingInvoice.id 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Berechne Vergütung
    const task = submission.tasks as any;
    const HOURLY_RATE = 55; // Fester Stundensatz für Freelancer
    
    // Stunden: entweder explizit übergeben, aus Task, oder Default 1
    const finalHours = hours_worked || task?.estimated_hours || 1;
    
    // Brutto = Stunden × Stundensatz
    // Oder wenn compensation_amount im Task gesetzt ist, nehmen wir das
    const baseAmount = task?.compensation_amount 
      ? Number(task.compensation_amount)
      : finalHours * HOURLY_RATE;

    // Bonus aus Review berechnen (z.B. postalische Zusendung, Ausweisdokument)
    const sanitizedBreakdown: BonusItem[] = Array.isArray(bonus_breakdown)
      ? bonus_breakdown
          .filter((b) => b && typeof b.amount === "number" && b.amount > 0)
          .map((b) => ({ id: String(b.id), label: String(b.label), amount: Number(b.amount) }))
      : [];
    const computedBonus = sanitizedBreakdown.reduce((sum, b) => sum + b.amount, 0);
    const finalBonus = typeof bonus_amount === "number" && bonus_amount >= 0 ? bonus_amount : computedBonus;
    const grossAmount = baseAmount + finalBonus;

    // Generiere Rechnungsnummer
    const { data: invoiceNumber } = await supabase.rpc("generate_invoice_number");

    // Erstelle Rechnung
    const { data: invoice, error: invoiceError } = await supabase
      .from("freelancer_invoices")
      .insert({
        user_id: submission.employee_id,
        task_id: submission.task_id,
        submission_id: submission_id,
        task_title: task?.title || "Unbekannter Task",
        hours_worked: finalHours,
        hourly_rate: HOURLY_RATE,
        gross_amount: grossAmount,
        bonus_amount: finalBonus,
        bonus_breakdown: sanitizedBreakdown,
        invoice_number: invoiceNumber || `FL-${new Date().getFullYear()}-0001`,
        invoice_date: new Date().toISOString().split("T")[0],
        status: "pending",
        notes: `Automatisch erstellt für ${profile.first_name} ${profile.last_name}`
      })
      .select()
      .single();

    if (invoiceError) {
      return new Response(
        JSON.stringify({ error: "Failed to create invoice", details: invoiceError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Freelancer invoice created successfully",
        invoice: invoice
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in generate-freelancer-invoice:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
