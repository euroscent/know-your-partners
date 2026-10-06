import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escape special characters for Telegram HTML parse mode
function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_BOT_TOKEN) {
      console.log("TELEGRAM_BOT_TOKEN not configured, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { messageId, userId, message, virtualEmployeeId } = await req.json();
    
    console.log("Forwarding chat message to Telegram:", { messageId, userId, message: message?.substring(0, 50) });

    // Check if monitoring is active
    const { data: monitoring, error: monitorError } = await supabase
      .from("telegram_monitoring")
      .select("chat_id")
      .eq("is_active", true);

    if (monitorError || !monitoring || monitoring.length === 0) {
      console.log("No active Telegram monitoring, skipping chat forward");
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name, last_name, email, telegram_notifications_enabled, mentor_id")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return new Response(JSON.stringify({ ok: true, error: "Profile not found" }), { headers: corsHeaders });
    }

    // Note: telegram_notifications_enabled only controls SMS/Email forwarding, not chat messages
    // Chat messages are ALWAYS forwarded to Telegram for admin visibility

    const userName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email || 'Unbekannt';

    // Get virtual employee info if message was sent to one
    let recipientInfo = "HR-Team";
    if (virtualEmployeeId) {
      const { data: virtualEmployee } = await supabase
        .from("virtual_employees")
        .select("first_name, last_name, job_title")
        .eq("id", virtualEmployeeId)
        .single();
      
      if (virtualEmployee) {
        recipientInfo = `${virtualEmployee.first_name} ${virtualEmployee.last_name}`;
      }
    }

    // Get mentor if assigned
    let mentorInfo: { id: string; name: string } | null = null;
    if (profile.mentor_id) {
      const { data: mentor } = await supabase
        .from("virtual_employees")
        .select("id, first_name, last_name")
        .eq("id", profile.mentor_id)
        .single();
      
      if (mentor) {
        mentorInfo = {
          id: mentor.id,
          name: `${mentor.first_name} ${mentor.last_name}`
        };
      }
    }

    // Get some active virtual employees for reply options
    const { data: virtualEmployees } = await supabase
      .from("virtual_employees")
      .select("id, first_name, last_name, job_title, department")
      .eq("is_active", true)
      .limit(5);

    // Build message
    const truncatedMessage = message.length > 500 ? message.substring(0, 500) + "..." : message;
    
    let telegramMessage = `💬 <b>Neue Chat-Nachricht</b>\n\n`;
    telegramMessage += `👤 Von: <b>${escapeTelegramHtml(userName)}</b>\n`;
    telegramMessage += `📨 An: ${escapeTelegramHtml(recipientInfo)}\n\n`;
    telegramMessage += `<i>"${escapeTelegramHtml(truncatedMessage)}"</i>`;

    // Build reply buttons - ONLY show the addressed recipient
    // Use shortened IDs (first 8 chars) to stay under Telegram's 64-byte callback_data limit
    const shortMsgId = messageId.substring(0, 8);
    const shortUserId = userId.substring(0, 8);
    // Use message-scoped tokens to avoid collisions across different users/messages
    const userToken = `${shortMsgId}${shortUserId}`;
    const replyButtons: Array<{ text: string; callback_data: string }[]> = [];

    // Store mapping for target profile (used for replies)
    await supabase
      .from("telegram_id_map")
      .upsert(
        {
          short_id: userToken,
          entity: "profile",
          full_id: userId,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "short_id" }
      );

    // If message was addressed to a specific virtual employee - ONLY show that person
    if (virtualEmployeeId) {
      const { data: addressedEmployee } = await supabase
        .from("virtual_employees")
        .select("id, first_name, last_name, job_title")
        .eq("id", virtualEmployeeId)
        .single();
      
      if (addressedEmployee) {
        const shortVeId = addressedEmployee.id.substring(0, 8);
        const personaToken = `${shortMsgId}${shortVeId}`;

        // Store mapping for addressed persona
        await supabase
          .from("telegram_id_map")
          .upsert(
            {
              short_id: personaToken,
              entity: "virtual_employee",
              full_id: addressedEmployee.id,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: "short_id" }
          );

        replyButtons.push([
          {
            text: `✉️ Als ${addressedEmployee.first_name} ${addressedEmployee.last_name} antworten`,
            callback_data: `cr:${shortMsgId}:${personaToken}:${userToken}`
          }
        ]);
      }
      // No other options when addressed to a specific person
    } else {
      // Message was sent to HR-Team (no specific recipient) - ONLY show HR
      replyButtons.push([
        {
          text: "💼 Als HR-Team antworten",
          // Use the same mapped token format as virtual employee replies
          // so telegram-callback can resolve the target user reliably.
          callback_data: `cr:${shortMsgId}:hr:${userToken}`
        }
      ]);
    }

    // Send to all active monitoring chats
    for (const monitor of monitoring) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: monitor.chat_id,
            text: telegramMessage,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: replyButtons
            }
          }),
        });

        const result = await response.json();
        console.log("Telegram response:", result.ok ? "success" : result.description);
      } catch (e) {
        console.error("Failed to send Telegram message:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error: any) {
    console.error("Error in telegram-chat-forward:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
