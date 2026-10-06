import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { iban } = await req.json();

    if (!iban) {
      throw new Error("IBAN is required");
    }

    const ibanCleaned = iban.replace(/\s/g, "").toUpperCase();

    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(ibanCleaned)) {
      throw new Error("Invalid IBAN format");
    }

    console.log("Fetching BIC for IBAN:", ibanCleaned);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let response = await fetch(`https://openiban.com/validate/${ibanCleaned}?getBIC=true&validateBankCode=true`, {
      signal: controller.signal,
    });

    console.log("OpenIBAN API response status:", response.status);

    if (!response.ok) {
      const firstErr = await response.text();
      console.error("OpenIBAN API error (attempt 1):", response.status, firstErr);
      response = await fetch(`https://openiban.com/validate/${ibanCleaned}`, { signal: controller.signal });
      console.log("OpenIBAN API response status (attempt 2):", response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenIBAN API error (attempt 2):", response.status, errorText);
        clearTimeout(timeout);
        throw new Error(`Failed to fetch BIC data: ${response.status} - ${errorText}`);
      }
    }

    const data = await response.json();
    clearTimeout(timeout);
    console.log("OpenIBAN API response data:", JSON.stringify(data));

    if (data.valid && data.bankData?.bic) {
      return new Response(
        JSON.stringify({
          bic: data.bankData.bic,
          bankName: data.bankData.name || null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    } else {
      return new Response(
        JSON.stringify({
          error: "BIC konnte nicht ermittelt werden",
          bic: null,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        },
      );
    }
  } catch (error) {
    console.error("Error fetching BIC:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({
        error: errorMessage,
        bic: null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
