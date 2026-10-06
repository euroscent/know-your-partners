import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeData {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  city: string | null;
  street: string | null;
  postal_code: string | null;
  phone?: string | null;
}

type TelegramErrorPayload = {
  ok: false;
  error_code?: number;
  description?: string;
};

function normalizeTelegramChatId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("-")) return trimmed;
  return trimmed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.error("Telegram credentials not configured");
      throw new Error("Telegram credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const {
      employee,
      user_id,
      chat_id,
    }: { employee: EmployeeData; user_id?: string; chat_id?: string } = await req.json();

    const resolvedChatId = normalizeTelegramChatId(chat_id ?? TELEGRAM_CHAT_ID);
    console.log("Resolved Telegram chat_id:", resolvedChatId);
    console.log("Received employee data:", JSON.stringify(employee, null, 2));
    console.log("User ID for documents:", user_id);

    // Validate chat_id first
    const getChatUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat?chat_id=${encodeURIComponent(resolvedChatId)}`;
    const getChatRes = await fetch(getChatUrl);
    const getChatJson = await getChatRes.json().catch(() => null);
    console.log("Telegram getChat response:", JSON.stringify(getChatJson, null, 2));

    if (!getChatRes.ok || (getChatJson && getChatJson.ok === false)) {
      const payload = (getChatJson ?? {}) as Partial<TelegramErrorPayload>;
      const description = payload.description || "Telegram getChat failed";
      return new Response(
        JSON.stringify({
          error: description,
          hint: "Der Bot hat keinen Zugriff auf diesen Chat. Stelle sicher: Bot zur Gruppe hinzugefügt (oder /start im privaten Chat) und nutze die korrekte Gruppen-/Supergruppen-Chat-ID (meist negativ, Supergruppen oft -100...).",
          resolved_chat_id: resolvedChatId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Delete previous telegram messages for this user
    if (user_id) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("telegram_message_ids")
        .eq("id", user_id)
        .single();

      if (profileData?.telegram_message_ids) {
        const messageIds = profileData.telegram_message_ids as number[];
        for (const msgId of messageIds) {
          try {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: resolvedChatId,
                message_id: msgId,
              }),
            });
          } catch (e) {
            console.log("Could not delete old message:", msgId);
          }
        }
      }
    }

    // Build simple message with inline button - NO details, NO images yet
    const employeeName = `${employee.first_name || 'N/A'} ${employee.last_name || 'N/A'}`;
    const buttonMessage = `👤 <b>${employeeName}</b>\n\n<i>Tippe auf den Button um Details und Dokumente anzuzeigen.</i>`;

    // Create inline keyboard with "Details anzeigen" button
    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "📋 Details & Dokumente anzeigen",
            callback_data: `show_details:${user_id}`,
          },
        ],
      ],
    };

    // Send message with inline button
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: resolvedChatId,
        text: buttonMessage,
        parse_mode: "HTML",
        reply_markup: inlineKeyboard,
      }),
    });

    const result = await response.json();
    console.log("Telegram sendMessage result:", JSON.stringify(result, null, 2));

    let sentMessageIds: number[] = [];
    if (result.ok) {
      sentMessageIds = [result.result.message_id];
    }

    // Store message IDs for future replacement
    if (user_id && sentMessageIds.length > 0) {
      await supabase
        .from("profiles")
        .update({ telegram_message_ids: sentMessageIds })
        .eq("id", user_id);
    }

    console.log(`Telegram notification with inline button sent successfully.`);
    return new Response(
      JSON.stringify({ success: true, message_id: sentMessageIds[0] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending Telegram notification:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
