import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, ClipboardCheck, Loader2, Play, Send, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { PageLoader } from "@/components/PageLoader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast-stub";

type QuestionType = "scale5" | "scale10" | "yesno" | "single" | "text";

type ProductTestQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
  follow_up_on_yes?: { id: string; label: string; required?: boolean } | null;
};

type ProductTestConfig = {
  title?: string;
  description?: string;
  duration?: number;
  duration_unit?: "minutes" | "hours" | "days";
  require_confirmation?: boolean;
  confirmation_text?: string | null;
  tasks?: { id: string; title: string; description?: string }[];
  questions?: ProductTestQuestion[];
};

type ProductTestResponse = {
  step?: { id: string; title?: string; description?: string };
  config?: ProductTestConfig;
  participation: {
    status: "not_started" | "running" | "ready_for_review" | "completed";
    started_at: string | null;
    review_available_at: string | null;
    completed_at: string | null;
    answers: Record<string, unknown>;
  };
  review_available: boolean;
  remaining_ms: number;
  server_time: string;
};

const answerSchema = z.record(z.string().min(1).max(5000), z.union([z.string().max(5000), z.number().finite()]));

const formatDuration = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days} ${days === 1 ? "Tag" : "Tage"} ${String(hours).padStart(2, "0")} Std.`;
  if (hours > 0) return `${hours} Std. ${String(minutes).padStart(2, "0")} Min.`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const durationLabel = (config: ProductTestConfig) => {
  const amount = config.duration ?? 0;
  const unit = config.duration_unit === "minutes" ? "Minuten" : config.duration_unit === "days" ? "Tage" : "Stunden";
  return `${amount} ${unit}`;
};

const ProductTest = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ProductTestResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const config = data?.config ?? {};
  const questions = config.questions ?? [];
  const participationStatus = data?.participation.status;
  const isRunning = participationStatus === "running" && !data?.review_available;
  const isReady = participationStatus === "ready_for_review" || data?.review_available === true;
  const isCompleted = participationStatus === "completed";

  const loadStatus = useCallback(async () => {
    if (!taskId) {
      navigate("/dashboard/tasks", { replace: true });
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      const redirect = `/dashboard/tasks/${taskId}/product-test`;
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    const { data: submission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();
    const adminData = (submission?.admin_data as Record<string, unknown> | null) ?? {};
    const qualityCheckCompleted = Boolean(adminData.quality_check_completed_at);
    if (!qualityCheckCompleted) {
      navigate(`/dashboard/tasks/${taskId}/quality-check`, { replace: true });
      return;
    }

    const { data: response, error: invokeError } = await supabase.functions.invoke("product-test", {
      body: { action: "status", task_id: taskId },
    });

    if (invokeError || !response) {
      setError(invokeError?.message ?? "Produkttest konnte nicht geladen werden.");
      setLoading(false);
      return;
    }

    const nextData = response as ProductTestResponse;
    setData(nextData);
    setRemainingMs(nextData.remaining_ms ?? 0);
    setAnswers((nextData.participation.answers ?? {}) as Record<string, string | number>);
    setLoading(false);
  }, [navigate, taskId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(() => {
      setRemainingMs((current) => {
        const next = Math.max(0, current - 1000);
        if (next === 0) void loadStatus();
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRunning, loadStatus]);

  const updateAnswer = (id: string, value: string | number) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setError(null);
  };

  const startTest = async () => {
    if (!taskId || (config.require_confirmation && !confirmed)) {
      setError("Bitte bestätige zuerst die Startbedingungen.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: response, error: invokeError } = await supabase.functions.invoke("product-test", {
      body: { action: "start", task_id: taskId, step_id: data?.step?.id },
    });
    setBusy(false);
    if (invokeError || !response) {
      setError(invokeError?.message ?? "Produkttest konnte nicht gestartet werden.");
      return;
    }
    const nextData = response as ProductTestResponse;
    setData(nextData);
    setRemainingMs(nextData.remaining_ms ?? 0);
    toast.success("Produkttest gestartet.");
  };

  const goToNextStep = async () => {
    if (!taskId) return;
    const [{ data: task }, { data: submission }] = await Promise.all([
      supabase.from("tasks").select("steps").eq("id", taskId).single(),
      supabase.from("task_submissions").select("admin_data").eq("task_id", taskId).maybeSingle(),
    ]);
    const steps = Array.isArray(task?.steps) ? task.steps : [];
    const adminData = (submission?.admin_data as Record<string, unknown> | null) ?? {};
    const hasUploads = steps.some((step: any) => step?.type === "file");
    const qualityComplete = Boolean(adminData.quality_check_completed_at);
    const postalComplete = Boolean(adminData.postal_documents_completed_at || adminData.postal_documents_completed);

    if (!qualityComplete) {
      navigate(`/dashboard/tasks/${taskId}/quality-check`, { replace: true });
    } else if (hasUploads && !postalComplete) {
      navigate(`/dashboard/tasks/${taskId}/postal-documents-check`, { replace: true });
    } else if (hasUploads) {
      navigate(`/dashboard/tasks/${taskId}?section=uploads`, { replace: true });
    } else {
      // Fragebogen und Produkttest abgeschlossen -> jetzt zur Prüfung einreichen
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("task_submissions")
          .update({ status: "awaiting_review", submitted_at: new Date().toISOString() })
          .eq("task_id", taskId)
          .eq("employee_id", session.user.id)
          .neq("status", "completed");
      }
      navigate(`/dashboard/tasks/${taskId}/submitted`, { replace: true });
    }
  };


  const submitTest = async () => {
    if (!taskId) return;
    const parsed = answerSchema.safeParse(answers);
    if (!parsed.success) {
      setError("Bitte fülle alle Antworten korrekt aus.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data: response, error: invokeError } = await supabase.functions.invoke("product-test", {
      body: { action: "submit", task_id: taskId, step_id: data?.step?.id, answers: parsed.data },
    });
    setBusy(false);
    if (invokeError || !response) {
      setError(invokeError?.message ?? "Bewertung konnte nicht abgesendet werden.");
      return;
    }
    setData(response as ProductTestResponse);
    toast.success("Produkttest abgeschlossen.");
  };

  const scaleOptions = useMemo(() => (type: QuestionType) => {
    const end = type === "scale10" ? 10 : 5;
    return Array.from({ length: end }, (_, index) => String(index + 1));
  }, []);

  if (loading) return <PageLoader />;

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <Card className="w-full border-destructive/40">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button onClick={() => void loadStatus()}>Erneut versuchen</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/tasks/${taskId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Zur Aufgabe
        </Button>

        <Card className="border-primary/20 shadow-xl">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <Badge variant="outline" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Produkttest</Badge>
                <CardTitle className="text-2xl md:text-3xl">{config.title || data?.step?.title || "Produkttest"}</CardTitle>
                <CardDescription className="max-w-2xl whitespace-pre-wrap">{config.description || data?.step?.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <Clock3 className="h-4 w-4 text-primary" /> {durationLabel(config)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 p-4 md:p-8">
            {error && <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

            {participationStatus === "not_started" && (
              <div className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border border-border bg-muted/30 p-4"><ClipboardCheck className="mb-2 h-5 w-5 text-primary" /><p className="text-sm font-medium">Aufgaben durchführen</p><p className="mt-1 text-xs text-muted-foreground">Arbeite die angegebenen Testaufgaben im Alltag ab.</p></div>
                  <div className="rounded-md border border-border bg-muted/30 p-4"><Clock3 className="mb-2 h-5 w-5 text-primary" /><p className="text-sm font-medium">Wartezeit beachten</p><p className="mt-1 text-xs text-muted-foreground">Die Bewertung wird nach Ablauf der Testdauer freigeschaltet.</p></div>
                  <div className="rounded-md border border-border bg-muted/30 p-4"><Send className="mb-2 h-5 w-5 text-primary" /><p className="text-sm font-medium">Ergebnis absenden</p><p className="mt-1 text-xs text-muted-foreground">Beantworte anschließend die Bewertungsfragen.</p></div>
                </div>
                {config.require_confirmation && (
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted/20 p-4">
                    <Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} />
                    <span className="text-sm">{config.confirmation_text || "Ich bestätige, dass ich bereit bin, den Produkttest zu starten."}</span>
                  </label>
                )}
                <Button onClick={() => void startTest()} disabled={busy} size="lg">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Produkttest starten
                </Button>
              </div>
            )}

            {isRunning && (
              <div className="space-y-6">
                <div className="rounded-md border border-primary/30 bg-primary/10 p-5 text-center">
                  <p className="text-sm text-muted-foreground">Bewertung verfügbar in</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-primary">{formatDuration(remainingMs)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Die Fragen werden automatisch freigeschaltet, sobald die Testdauer abgelaufen ist.</p>
                </div>
                {config.tasks && config.tasks.length > 0 && <TaskList tasks={config.tasks} />}
              </div>
            )}

            {isReady && !isCompleted && (
              <div className="space-y-6">
                {config.tasks && config.tasks.length > 0 && <TaskList tasks={config.tasks} />}
                <div className="space-y-4">
                  <div><h2 className="text-xl font-semibold">Bewertung</h2><p className="text-sm text-muted-foreground">Wie hast du den Produkttest erlebt?</p></div>
                  {questions.map((question, index) => (
                    <QuestionField key={question.id} question={question} index={index} value={answers[question.id]} followUpValue={question.follow_up_on_yes ? answers[question.follow_up_on_yes.id] : undefined} onChange={updateAnswer} scaleOptions={scaleOptions} />
                  ))}
                </div>
                <Button onClick={() => void submitTest()} disabled={busy || questions.length === 0} size="lg">
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Bewertung absenden
                </Button>
              </div>
            )}

            {isCompleted && (
              <div className="space-y-5 py-6 text-center">
                <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
                <div><h2 className="text-2xl font-semibold">Produkttest abgeschlossen</h2><p className="mt-2 text-muted-foreground">Deine Bewertung wurde erfolgreich übermittelt.</p></div>
                <Button onClick={() => void goToNextStep()} size="lg">Weiter zur nächsten Aufgabe</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const TaskList = ({ tasks }: { tasks: { id: string; title: string; description?: string }[] }) => (
  <div className="space-y-3">
    <h2 className="text-xl font-semibold">Testaufgaben</h2>
    <div className="space-y-2">
      {tasks.map((task, index) => (
        <div key={task.id} className="flex gap-3 rounded-md border border-border bg-muted/20 p-4">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{index + 1}</span>
          <div><p className="font-medium">{task.title || "Testaufgabe"}</p>{task.description && <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>}</div>
        </div>
      ))}
    </div>
  </div>
);

const QuestionField = ({ question, index, value, followUpValue, onChange, scaleOptions }: { question: ProductTestQuestion; index: number; value?: string | number; followUpValue?: string | number; onChange: (id: string, value: string | number) => void; scaleOptions: (type: QuestionType) => string[] }) => {
  const requiredLabel = question.required !== false ? " *" : "";
  return (
    <div className="space-y-3 rounded-md border border-border bg-card/60 p-4">
      <Label className="text-sm font-medium">{index + 1}. {question.label || "Bewertungsfrage"}{requiredLabel}</Label>
      {(question.type === "scale5" || question.type === "scale10") && <RadioGroup value={value === undefined ? undefined : String(value)} onValueChange={(next) => onChange(question.id, Number(next))} className="flex flex-wrap gap-2">{scaleOptions(question.type).map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"><RadioGroupItem value={option} id={`${question.id}-${option}`} />{option}</label>)}</RadioGroup>}
      {question.type === "yesno" && <RadioGroup value={typeof value === "string" ? value : undefined} onValueChange={(next) => onChange(question.id, next)} className="flex flex-wrap gap-3"><label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><RadioGroupItem value="ja" id={`${question.id}-yes`} />Ja</label><label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><RadioGroupItem value="nein" id={`${question.id}-no`} />Nein</label></RadioGroup>}
      {question.type === "single" && <RadioGroup value={typeof value === "string" ? value : undefined} onValueChange={(next) => onChange(question.id, next)} className="space-y-2">{(question.options ?? []).map((option) => <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><RadioGroupItem value={option} id={`${question.id}-${option}`} />{option}</label>)}</RadioGroup>}
      {question.type === "text" && <Textarea value={typeof value === "string" ? value : ""} onChange={(event) => onChange(question.id, event.target.value)} maxLength={5000} rows={4} placeholder="Deine Antwort" />}
      {question.type === "yesno" && question.follow_up_on_yes && value === "ja" && <div className="space-y-2 border-l-2 border-primary/40 pl-4"><Label className="text-sm">{question.follow_up_on_yes.label}{question.follow_up_on_yes.required !== false ? " *" : ""}</Label><Input value={typeof followUpValue === "string" ? followUpValue : ""} onChange={(event) => onChange(question.follow_up_on_yes?.id ?? "", event.target.value)} maxLength={5000} /></div>}
    </div>
  );
};

export default ProductTest;
