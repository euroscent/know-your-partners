import { createClient } from "npm:@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Check if any admin is currently online (last_seen within 2 minutes)
async function isAnyAdminOnline(supabase: any): Promise<boolean> {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from("admin_presence")
    .select("admin_id")
    .eq("is_online", true)
    .gte("last_seen_at", twoMinutesAgo);
  
  if (error) {
    console.error("Error checking admin presence:", error);
    return false;
  }
  
  return (data?.length || 0) > 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, userId } = await req.json();
    console.log("Received message:", message, "userId:", userId);

    if (!message || typeof message !== "string") {
      throw new Error("Message is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Processing message:", message);

    // Check if any admin is online
    const adminOnline = await isAnyAdminOnline(supabase);
    console.log("Admin online:", adminOnline);

    const normalizedMessage = message.toLowerCase().trim();

    const { data: faqs, error: faqError } = await supabase
      .from("faq_responses")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (faqError) {
      console.error("Error fetching FAQs:", faqError);
      throw faqError;
    }

    console.log(`Found ${faqs?.length || 0} active FAQs`);

    let bestMatch = null;
    let highestScore = 0;

    for (const faq of faqs || []) {
      let score = 0;

      for (const keyword of faq.keywords) {
        if (normalizedMessage.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      if (normalizedMessage.includes(faq.question.toLowerCase())) {
        score += 50;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = faq;
      }
    }

    console.log("Best match score:", highestScore);

    if (bestMatch && highestScore > 5) {
      console.log("Found matching FAQ:", bestMatch.question);
      return new Response(
        JSON.stringify({
          answer: bestMatch.answer,
          category: bestMatch.category,
          matched: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // No match found - check if admin is online
    console.log("No matching FAQ found, admin online:", adminOnline);

    // Create admin notification regardless of online status
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();

      const userName = profile ? `${profile.first_name} ${profile.last_name}` : "einem Mitarbeiter";

      // Get all admins and create notifications
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications = admins.map((admin) => ({
          admin_id: admin.user_id,
          user_id: userId,
          message: `Unbeantwortete Frage von ${userName}: "${message.substring(0, 50)}${message.length > 50 ? "..." : ""}"`,
          type: "unanswered_question",
          is_read: false,
        }));

        await supabase.from("admin_notifications").insert(notifications);
        console.log(`Created ${notifications.length} admin notifications`);
      }
    }

    // If admin is online, don't send automatic response - let admin respond manually
    if (adminOnline) {
      console.log("Admin is online - not sending automatic response");
      return new Response(
        JSON.stringify({
          answer: null,
          matched: false,
          needsAdmin: true,
          adminOnline: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Admin is offline - send automatic response
    const defaultResponse =
      "Ich bin der ES Assistent. Deine Nachricht wurde an unser Team weitergeleitet. Ein Admin wird sich so schnell wie möglich bei dir melden.";

    return new Response(
      JSON.stringify({
        answer: defaultResponse,
        matched: false,
        needsAdmin: true,
        adminOnline: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in employee-chat:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        answer:
          "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut oder kontaktiere die Personalabteilung direkt.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});