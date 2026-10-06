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
    const { imageBase64, side } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ detected: false, error: "No image provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ detected: false, error: "API key not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Strict prompts: require face + readable fields (front) or MRZ (back)
    const prompt = side === "back"
      ? `You are verifying if a camera image shows the BACK SIDE of a German ID card (Personalausweis) or residence permit (Aufenthaltstitel).

REQUIRED features – the image MUST contain ALL of these:
1. Machine Readable Zone (MRZ): Two lines of uppercase letters/digits, typically starting with "IDD<<" or "D<<".
2. At least one date in DD.MM.YYYY or YYMMDD format.
3. Either the German eagle (Bundesadler) OR the text "BUNDESREPUBLIK" / "DEUTSCHLAND".

If ANY required feature is missing, respond detected: false.

IMPORTANT: On the back side of German IDs, look for "Geburtsort" (place of birth) which is often printed next to other data. Extract it if visible.

Respond ONLY with a JSON object (no markdown):
{"detected": true, "confidence": "high", "reason": "Saw MRZ + date + eagle", "placeOfBirth": "BERLIN"}
or
{"detected": false, "confidence": "low", "reason": "Missing MRZ"}`
      : `You are an expert at reading German identity documents. Verify if this camera image shows the FRONT SIDE of a German ID card (Personalausweis) or residence permit (Aufenthaltstitel).

REQUIRED features – the image MUST contain ALL of these:
1. A visible passport photo showing a human face.
2. At least THREE of the following text fields clearly readable:
   - Nachname / Name / Familienname (Surname)
   - Vorname / Vornamen (Given names)
   - Geburtsdatum / Geb. (Date of birth)
   - Staatsangehörigkeit (Nationality, e.g. "DEUTSCH")
   - Geburtsort / Ort (Place of birth) - IMPORTANT: This is usually located below the birth date or near "Geburtsort:"
   - Gültig bis / Ablaufdatum (Expiry date)
3. The words "BUNDESREPUBLIK DEUTSCHLAND" or "PERSONALAUSWEIS" or "AUFENTHALTSTITEL".

If the face is not visible OR fewer than three data fields are readable, respond detected: false.

CRITICAL EXTRACTION RULES:
- Extract ALL visible fields, especially "Geburtsort" (place of birth)
- On German IDs, the place of birth is typically a city name like "BERLIN", "MÜNCHEN", "HAMBURG", "KÖLN" etc.
- Look carefully near the label "Geburtsort" or "Ort" for the city name
- The place of birth is REQUIRED if visible - do NOT return null if you can read it
- Use exactly the format shown on the ID (usually UPPERCASE)

When detected: true, extract these values (use null ONLY if truly not readable):
- surname: Family name / Nachname
- givenNames: First names / Vornamen  
- dateOfBirth: Birth date in DD.MM.YYYY format
- nationality: Usually "DEUTSCH" for German citizens
- placeOfBirth: City of birth - MUST extract if visible on the card
- expiryDate: Expiry date in DD.MM.YYYY format

Respond ONLY with a JSON object (no markdown):
{"detected": true, "confidence": "high", "reason": "Face visible, all fields read", "surname": "MUSTERMANN", "givenNames": "ERIKA", "dateOfBirth": "12.08.1964", "nationality": "DEUTSCH", "placeOfBirth": "BERLIN", "expiryDate": "01.11.2031"}
or
{"detected": false, "confidence": "low", "reason": "No face visible"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ detected: false, error: "Rate limit exceeded" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ detected: false, error: "Payment required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 402 }
        );
      }
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ detected: false, error: "AI analysis failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    console.log("AI response:", content);

    // Parse the JSON response
    try {
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(cleanContent);
      
      return new Response(
        JSON.stringify({
          detected: result.detected === true,
          confidence: result.confidence || "unknown",
          reason: result.reason || "",
          // Extracted fields (front side)
          surname: result.surname || null,
          givenNames: result.givenNames || null,
          dateOfBirth: result.dateOfBirth || null,
          nationality: result.nationality || null,
          placeOfBirth: result.placeOfBirth || null,
          expiryDate: result.expiryDate || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch {
      // Fallback: strict – if we can't parse, consider not detected
      console.error("Failed to parse AI response as JSON:", content);
      return new Response(
        JSON.stringify({
          detected: false,
          confidence: "low",
          reason: "AI response parse error",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error: unknown) {
    console.error("Error in detect-german-id:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ detected: false, error: message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
