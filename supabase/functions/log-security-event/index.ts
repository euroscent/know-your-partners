import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getApiKey } from '../_shared/getApiKey.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UNAUTHENTICATED_EVENTS = new Set([
  "login_failure",
  "signup",
  "password_reset",
]);

const ATTACKER_EVENT_TYPES = new Set([
  "brute_force",
  "suspicious_activity",
]);

function sanitize(input: string | null | undefined, maxLength = 200): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c))
    .substring(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidEventType(type: string): boolean {
  const allowed = new Set([
    "login_success", "login_failure", "password_reset", "signup",
    "admin_action", "admin_login", "suspicious_activity", "logout",
    "session_created", "profile_update", "settings_change",
    "data_export", "file_upload", "file_download", "permission_change",
    "password_change", "account_lockout", "mfa_attempt",
  ]);
  return allowed.has(type);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const {
      event_type,
      severity = "info",
      user_id,
      email,
      metadata = {},
    } = body;

    if (!event_type || typeof event_type !== "string") {
      return new Response(
        JSON.stringify({ error: "event_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEventType(event_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid event_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!UNAUTHENTICATED_EVENTS.has(event_type)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (user_id && user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "user_id mismatch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const clientIP =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const { data: isFlooding } = await supabaseAdmin.rpc("check_brute_force", {
      _identifier: clientIP,
      _action: "security_log_request",
      _window_minutes: 1,
      _max_attempts: 30,
    });

    if (isFlooding) {
      return new Response(
        JSON.stringify({ error: "Rate limited" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sanitizedEmail = email ? sanitize(email, 254) : null;
    if (sanitizedEmail && !isValidEmail(sanitizedEmail)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ip_address = sanitize(clientIP, 45);
    const user_agent = sanitize(req.headers.get("user-agent"), 500) || "unknown";
    const country = sanitize(req.headers.get("cf-ipcountry") || metadata?.country, 5) || null;
    const city = sanitize(req.headers.get("cf-ipcity") || metadata?.city, 100) || null;
    const device_fingerprint = btoa(user_agent).slice(0, 32);

    const sanitizedMetadata: Record<string, any> = {};
    const metadataStr = JSON.stringify(metadata);
    if (metadataStr.length <= 5000) {
      Object.assign(sanitizedMetadata, metadata);
    }

    let actualSeverity = severity === "critical" || severity === "warning" ? severity : "info";
    let isThreat = false;

    if (event_type === "login_failure") {
      const { data: isBruteForce } = await supabaseAdmin.rpc("check_brute_force", {
        _identifier: sanitizedEmail || ip_address,
        _action: "login_failure",
        _window_minutes: 15,
        _max_attempts: 5,
      });

      if (isBruteForce) {
        actualSeverity = "critical";
        isThreat = true;

        await supabaseAdmin.from("security_events").insert({
          event_type: "brute_force",
          severity: "critical",
          user_id: user_id || null,
          email: sanitizedEmail,
          ip_address,
          user_agent,
          country,
          city,
          device_fingerprint,
          metadata: {
            ...sanitizedMetadata,
            is_attacker: true,
            detected_pattern: "multiple_login_failures",
            window_minutes: 15,
          },
        });

        await createAdminNotification(supabaseAdmin, {
          message: `🛑 Brute-Force Angriff! IP: ${ip_address}, E-Mail: ${sanitizedEmail || "unbekannt"}`,
          type: "security_critical",
        });

        await sendTelegramSecurityAlert({
          event_type: "brute_force",
          ip_address,
          email: sanitizedEmail,
          country,
          city,
          details: "Mehrere fehlgeschlagene Login-Versuche in 15 Min",
        });
      }
    }

    if (event_type === "login_success" && user_id) {
      const { data: previousLogins } = await supabaseAdmin
        .from("security_events")
        .select("ip_address, user_agent")
        .eq("user_id", user_id)
        .eq("event_type", "login_success")
        .order("created_at", { ascending: false })
        .limit(10);

      const knownIPs = new Set(previousLogins?.map((l) => l.ip_address) || []);
      const knownUAs = new Set(previousLogins?.map((l) => l.user_agent) || []);

      if (previousLogins && previousLogins.length > 0) {
        if (!knownIPs.has(ip_address)) {
          sanitizedMetadata.new_ip = true;
          sanitizedMetadata.known_ips = Array.from(knownIPs).slice(0, 5);
          actualSeverity = "warning";
        }
        if (!knownUAs.has(user_agent)) {
          sanitizedMetadata.new_device = true;
          actualSeverity = "warning";
        }

        if (sanitizedMetadata.new_ip || sanitizedMetadata.new_device) {
          await createAdminNotification(supabaseAdmin, {
            message: `⚠️ Verdächtiger Login: ${sanitizedEmail || "unbekannt"} von ${sanitizedMetadata.new_ip ? "neuer IP " + ip_address : "neuem Gerät"}`,
            type: "security_warning",
          });
        }
      }
    }

    if (ATTACKER_EVENT_TYPES.has(event_type)) {
      sanitizedMetadata.is_attacker = true;
      isThreat = true;
    }

    const { error } = await supabaseAdmin.from("security_events").insert({
      event_type,
      severity: actualSeverity,
      user_id: user_id || null,
      email: sanitizedEmail,
      ip_address,
      user_agent,
      country,
      city,
      device_fingerprint,
      metadata: { ...sanitizedMetadata, is_attacker: isThreat || sanitizedMetadata.is_attacker || false },
    });

    if (error) {
      console.error("Error inserting security event:", error);
      return new Response(
        JSON.stringify({ error: "Failed to log event" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (actualSeverity === "critical" && !isThreat) {
      await createAdminNotification(supabaseAdmin, {
        message: `🚨 Kritisches Event: ${event_type} - IP: ${ip_address}`,
        type: "security_critical",
      });

      await sendTelegramSecurityAlert({
        event_type,
        ip_address,
        email: sanitizedEmail,
        country,
        city,
        details: `Severity: ${actualSeverity}`,
      });
    }

    return new Response(
      JSON.stringify({ success: true, severity: actualSeverity, is_threat: isThreat }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Security event logging error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function createAdminNotification(
  supabase: any,
  { message, type }: { message: string; type: string }
) {
  try {
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (admins && admins.length > 0) {
      const notifications = admins.map((admin: any) => ({
        admin_id: admin.user_id,
        message: message.substring(0, 500),
        type,
        is_read: false,
      }));
      await supabase.from("admin_notifications").insert(notifications);
    }
  } catch (err) {
    console.error("Failed to create admin notification:", err);
  }
}

async function sendTelegramSecurityAlert(
  { event_type, ip_address, email, country, city, details }: {
    event_type: string;
    ip_address: string | null;
    email: string | null;
    country: string | null;
    city: string | null;
    details: string;
  }
) {
  try {
    const TELEGRAM_BOT_TOKEN = await getApiKey("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = await getApiKey("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log("Telegram not configured, skipping security alert");
      return;
    }

    const location = [city, country].filter(Boolean).join(", ") || "unbekannt";
    const timestamp = new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" });

    const message = [
      "🚨🔴 SECURITY ALERT 🔴🚨",
      "",
      `Typ: ${event_type.replace(/_/g, " ").toUpperCase()}`,
      `IP: ${ip_address || "unbekannt"}`,
      `E-Mail: ${email || "unbekannt"}`,
      `Standort: ${location}`,
      `Details: ${details}`,
      `Zeit: ${timestamp}`,
      "",
      "⚡ Sofortige Überprüfung empfohlen!",
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID.trim(),
        text: message,
      }),
    });
  } catch (err) {
    console.error("Failed to send Telegram security alert:", err);
  }
}
