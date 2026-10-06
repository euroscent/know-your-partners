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
    const { taskTitle, emailType, currentContent } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating email subject for:", { taskTitle, emailType });

    const emailTypeDescriptions: Record<string, string> = {
      'opening': 'Eröffnungs-E-Mail (wenn Demo-Daten bereitgestellt werden)',
      'completion': 'Abschluss-E-Mail (wenn die Aufgabe erfolgreich abgeschlossen wurde)'
    };

    const systemPrompt = `Du bist ein E-Mail-Marketing-Experte für ein KYC (Know Your Customer) Unternehmen.
Du erstellst professionelle, aufmerksamkeitsstarke E-Mail-Betreffzeilen.

WICHTIG:
- Der Betreff muss kurz und prägnant sein (max. 60 Zeichen)
- Der Betreff soll zum Öffnen der E-Mail motivieren
- Verwende keine Spam-Wörter oder übertriebene Ausrufezeichen
- Passe den Ton an den E-Mail-Typ an
- Erwähne den Auftragsname/Service wenn passend
- Sei kreativ aber professionell`;

    const userPrompt = `Erstelle einen professionellen E-Mail-Betreff für folgende Situation:

Auftragsname: ${taskTitle || "Demo-Auftrag"}
E-Mail-Typ: ${emailTypeDescriptions[emailType] || emailType}
${currentContent ? `\nAktueller E-Mail-Inhalt (zur Orientierung):\n${currentContent.substring(0, 500)}...` : ''}

Generiere NUR den Betreff-Text (ohne Anführungszeichen, ohne "Betreff:" Präfix).`;

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
        max_tokens: 100,
        temperature: 0.8,
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
    let generatedSubject = data.choices?.[0]?.message?.content || "";
    
    // Clean up the subject - remove quotes and trim
    generatedSubject = generatedSubject.trim().replace(/^["']|["']$/g, '');

    console.log("Generated subject:", generatedSubject);

    return new Response(JSON.stringify({ subject: generatedSubject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating email subject:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unbekannter Fehler" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
