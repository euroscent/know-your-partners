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
    const { htmlTemplate, taskTitle } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating email content for task:", taskTitle);

    // Step 1: Extract and store all base64 images to reduce payload size
    const imageMap: Record<string, string> = {};
    let imageCounter = 0;
    let cleanedHtml = htmlTemplate.replace(
      /(src=["'])(data:image\/[^;]+;base64,[^"']+)(["'])/gi,
      (_match: string, prefix: string, dataUrl: string, suffix: string) => {
        const placeholder = `__IMG_PLACEHOLDER_${imageCounter}__`;
        imageMap[placeholder] = dataUrl;
        imageCounter++;
        return `${prefix}${placeholder}${suffix}`;
      }
    );

    console.log(`Extracted ${imageCounter} base64 images from template`);

    const systemPrompt = `Du bist ein HTML-Layout-Experte. Deine Aufgabe ist es, E-Mail-Templates visuell zu optimieren - NUR Layout, Farben und Container.

DEINE AUFGABE:
- Optimiere das visuelle Layout (Abstände, Ausrichtung, Container-Breiten)
- Passe Farben harmonisch an (Hintergründe, Rahmen, Trennlinien)
- Stelle sicher, dass Logos und Bilder gut in das Layout passen
- Optimiere Container-Styles individuell für jeden Bereich

WAS DU TUN SOLLST:
1. Layout-Optimierung:
   - Konsistente Padding/Margin-Werte (z.B. 20px, 40px)
   - Zentrierte oder linksbündige Ausrichtung je nach Kontext
   - Optimale Container-Breiten (max-width: 600px für E-Mails)
   - Responsive-freundliche Styles

2. Farb-Anpassungen:
   - Harmonische Hintergrundfarben für verschiedene Bereiche
   - Dezente Rahmen und Trennlinien wo sinnvoll
   - Kontrast zwischen Text und Hintergrund sicherstellen

3. Container-Individualisierung:
   - Header-Bereich: Professionell, oft mit Firmenfarbe
   - Content-Bereich: Klar, gut lesbar, weiß oder hell
   - Footer-Bereich: Dezenter, oft grauer Hintergrund

4. Bild/Logo-Integration:
   - Sinnvolle max-width/height für Logos (z.B. max-height: 60px)
   - Zentrierte Ausrichtung wo passend
   - Abstände um Bilder herum

KRITISCH - NIEMALS ÄNDERN:
- ALLE Texte, Überschriften und Absätze EXAKT beibehalten
- ALLE Platzhalter wie {Email}, {passwort}, {vorname} etc. EXAKT beibehalten
- ALLE Bild-Platzhalter wie __IMG_PLACEHOLDER_X__ EXAKT so lassen
- ALLE <img> src-Attribute NICHT verändern
- KEINE neuen Texte erfinden oder hinzufügen
- KEINE Texte löschen oder umformulieren

Gib NUR das optimierte HTML zurück, ohne Erklärungen oder Markdown-Blöcke.`;

    const userPrompt = `Optimiere das Layout dieses HTML-Templates. Passe NUR Layout, Farben und Container an - KEINE Textänderungen!

Auftragsname zur Orientierung: "${taskTitle || 'Demo-Auftrag'}"

${cleanedHtml}

Gib NUR das optimierte HTML zurück.`;
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
        max_tokens: 4000,
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
    let generatedHtml = data.choices?.[0]?.message?.content || "";
    
    // Clean up any markdown code blocks if present
    generatedHtml = generatedHtml.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

    // Step 2: Restore all base64 images from placeholders
    for (const [placeholder, dataUrl] of Object.entries(imageMap)) {
      generatedHtml = generatedHtml.replace(new RegExp(placeholder, 'g'), dataUrl);
    }

    console.log("Generated HTML content length:", generatedHtml.length);

    return new Response(JSON.stringify({ html: generatedHtml }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error generating email content:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unbekannter Fehler" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
