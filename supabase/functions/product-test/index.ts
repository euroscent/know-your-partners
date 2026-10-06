import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "status" | "start" | "submit";

interface RequestBody {
  action?: Action;
  task_id?: string;
  step_id?: string;
  answers?: Record<string, unknown>;
}

interface ProductTestQuestion {
  id: string;
  label: string;
  type: "scale5" | "scale10" | "yesno" | "single" | "text";
  required?: boolean;
  options?: string[];
  follow_up_on_yes?: { id: string; label: string; required?: boolean } | null;
}

interface ProductTestConfig {
  title?: string;
  description?: string;
  duration?: number;
  duration_unit?: "minutes" | "hours" | "days";
  confirmation_text?: string | null;
  tasks?: { id: string; title: string; description?: string }[];
  questions?: ProductTestQuestion[];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const durationMs = (config: ProductTestConfig) => {
  const amount = Number(config.duration ?? 0);
  const unit = config.duration_unit ?? "hours";
  const factor = unit === "minutes" ? 60_000 : unit === "days" ? 86_400_000 : 3_600_000;
  return Math.max(0, amount) * factor;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = authData.user.id;

    const body: RequestBody = await req.json().catch(() => ({}));
    const action: Action = body.action ?? "status";
    const taskId = body.task_id;
    if (!taskId) return json({ error: "Missing task_id" }, 400);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load task + verify assignment
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, assigned_to, steps")
      .eq("id", taskId)
      .maybeSingle();

    if (taskError) throw taskError;
    if (!task) return json({ error: "Task not found" }, 404);
    if (task.assigned_to !== userId) return json({ error: "Forbidden" }, 403);

    const steps = Array.isArray(task.steps) ? (task.steps as any[]) : [];
    const step = body.step_id
      ? steps.find((s) => s?.id === body.step_id && s?.type === "product_test")
      : steps.find((s) => s?.type === "product_test");

    if (!step) return json({ error: "Product test step not found" }, 404);

    const config: ProductTestConfig = step.product_test ?? {};
    const stepId: string = step.id;

    const { data: submission } = await supabase
      .from("task_submissions")
      .select("id")
      .eq("task_id", taskId)
      .eq("employee_id", userId)
      .maybeSingle();

    let { data: participation } = await supabase
      .from("product_test_participations")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", userId)
      .eq("step_id", stepId)
      .maybeSingle();

    const buildResponse = (p: any) => {
      const now = Date.now();
      const reviewAt = p?.review_available_at ? new Date(p.review_available_at).getTime() : null;
      const reviewAvailable = p?.status === "completed"
        ? true
        : reviewAt !== null && now >= reviewAt;
      const status = p?.status === "completed"
        ? "completed"
        : p?.status === "running" && reviewAvailable
          ? "ready_for_review"
          : (p?.status ?? "not_started");

      return json({
        step: { id: stepId, title: step.title, description: step.description },
        config,
        participation: p
          ? {
              status,
              started_at: p.started_at,
              review_available_at: p.review_available_at,
              completed_at: p.completed_at,
              answers: p.answers ?? {},
            }
          : { status: "not_started", started_at: null, review_available_at: null, completed_at: null, answers: {} },
        review_available: reviewAvailable,
        remaining_ms: reviewAt && !reviewAvailable ? reviewAt - now : 0,
        server_time: new Date().toISOString(),
      });
    };

    if (action === "status") {
      return buildResponse(participation);
    }

    if (action === "start") {
      if (participation && participation.status !== "not_started") {
        // idempotent: never restart / reset the timer
        return buildResponse(participation);
      }

      const startedAt = new Date();
      const reviewAt = new Date(startedAt.getTime() + durationMs(config));

      const payload = {
        task_id: taskId,
        user_id: userId,
        submission_id: submission?.id ?? null,
        step_id: stepId,
        status: "running",
        started_at: startedAt.toISOString(),
        review_available_at: reviewAt.toISOString(),
      };

      if (participation) {
        const { data, error } = await supabase
          .from("product_test_participations")
          .update(payload)
          .eq("id", participation.id)
          .select("*")
          .single();
        if (error) throw error;
        participation = data;
      } else {
        const { data, error } = await supabase
          .from("product_test_participations")
          .upsert(payload, { onConflict: "task_id,user_id,step_id" })
          .select("*")
          .single();
        if (error) throw error;
        participation = data;
      }

      return buildResponse(participation);
    }

    if (action === "submit") {
      if (!participation || !participation.started_at) {
        return json({ error: "Produkttest wurde noch nicht gestartet." }, 400);
      }
      if (participation.status === "completed") {
        return json({ error: "Die Bewertung wurde bereits abgesendet." }, 409);
      }

      const reviewAt = participation.review_available_at
        ? new Date(participation.review_available_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      if (Date.now() < reviewAt) {
        return json({ error: "Die Bewertung ist noch nicht verfügbar." }, 400);
      }

      const answers = (body.answers ?? {}) as Record<string, unknown>;
      const isEmpty = (v: unknown) =>
        v === undefined || v === null || (typeof v === "string" && v.trim() === "");

      const missing: string[] = [];
      for (const q of config.questions ?? []) {
        if (q.required !== false && isEmpty(answers[q.id])) {
          missing.push(q.label);
          continue;
        }
        if (q.type === "yesno" && q.follow_up_on_yes && answers[q.id] === "ja") {
          const fu = q.follow_up_on_yes;
          if (fu.required !== false && isEmpty(answers[fu.id])) missing.push(fu.label);
        }
      }

      if (missing.length > 0) {
        return json({ error: "Pflichtfelder fehlen", missing }, 400);
      }

      const { data, error } = await supabase
        .from("product_test_participations")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          answers,
          submission_id: participation.submission_id ?? submission?.id ?? null,
        })
        .eq("id", participation.id)
        .neq("status", "completed")
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "Die Bewertung wurde bereits abgesendet." }, 409);

      return buildResponse(data);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("product-test error:", error);
    return json({ error: error instanceof Error ? error.message : "Unbekannter Fehler" }, 500);
  }
});
