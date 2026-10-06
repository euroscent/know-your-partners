import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { taskTitle, employeeName, employeeFirstName } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating demo info text for:", { taskTitle, employeeName, employeeFirstName });

    const systemPrompt = `Du bist ein professioneller HR-Assistent für ein KYC (Know Your Customer) Unternehmen. 
Du erstellst freundliche, professionelle Eröffnungstexte für Demo-Aufträge.

WICHTIG:
- Der Text soll klar machen, dass es sich um einen DEMO-Auftrag handelt
- Verwende eine professionelle aber freundliche Ansprache
- Erwähne die Freude über die Teilnahme des Mitarbeiters
- Halte den Text kurz und prägnant (2-4 Sätze)
- Verwende "Sie" als Anrede
- Erwähne den Auftragsname wenn möglich
- Gib hilfreiche Hinweise für den Ablauf

Beispiel-Struktur:
- Begrüßung mit Namen
- Hinweis auf Demo-Charakter
- Freude über Teilnahme
- Kurzer Hinweis zum Ablauf`;

    const userPrompt = `Erstelle einen individuellen Eröffnungstext für folgenden Demo-Auftrag:

Auftragsname: ${taskTitle || "Demo-Auftrag"}
Mitarbeiter Vorname: ${employeeFirstName || "Mitarbeiter"}
Mitarbeiter vollständiger Name: ${employeeName || "Mitarbeiter"}

Generiere einen professionellen, freundlichen Text (2-4 Sätze).`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit erreicht, bitte versuchen Sie es später erneut." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits erschöpft, bitte laden Sie Ihr Konto auf." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || "";

    console.log("Generated text:", generatedText);

    return new Response(JSON.stringify({ text: generatedText.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating demo info text:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unbekannter Fehler" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
