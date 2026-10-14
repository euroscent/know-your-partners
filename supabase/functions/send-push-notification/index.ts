// Send Web-Push notifications via VAPID.
// Body: { user_ids?: string[]; user_id?: string; title: string; body: string; url?: string; tag?: string; category?: keyof NotificationCategories }

import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Category =
  | "new_tasks"
  | "demo_data_approved"
  | "inbox_codes"
  | "payouts"
  | "chat_messages";

interface PushPayload {
  user_ids?: string[];
  user_id?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  category?: Category;
}

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:office@euroscent.de";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: PushPayload = await req.json();
    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = payload.user_ids?.length
      ? payload.user_ids
      : payload.user_id
        ? [payload.user_id]
        : [];

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ error: "user_id or user_ids required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter by notification preferences if a category is set
    let allowedUserIds = userIds;
    if (payload.category) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select(`user_id, ${payload.category}`)
        .in("user_id", userIds);

      const blocked = new Set(
        (prefs ?? [])
          .filter((p: Record<string, unknown>) => p[payload.category!] === false)
          .map((p: { user_id: string }) => p.user_id),
      );
      allowedUserIds = userIds.filter((id) => !blocked.has(id));
    }

    if (allowedUserIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, skipped: userIds.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", allowedUserIds);

    if (subsErr) throw subsErr;

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard",
      tag: payload.tag,
    });

    let sent = 0;
    let removed = 0;
    const errors: string[] = [];

    await Promise.all(
      (subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            message,
          );
          sent++;
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // expired/gone — clean up
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            removed++;
          } else {
            errors.push(String(err));
          }
        }
      }),
    );

    return new Response(JSON.stringify({ ok: true, sent, removed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push-notification error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
