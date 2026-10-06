import { useEffect, useState, useRef } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, Check, Shield, GitBranch, FileText, Video, Users, Settings, MessageSquare, Scale, ClipboardList, Star, Wrench, Smartphone, User, Cog, Info } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { motion } from "framer-motion";
import number11Icon from "@/assets/number-11-icon.png";
import { TaskActionsBar } from "@/components/TaskActionsBar";
import { getPendingProductTestStep } from "@/lib/productTestFlow";


interface Task {
  id: string;
  title: string;
  description: string | null;
}

interface QualityCheckData {
  date: string;
  sessionId: string;
  identAgent: string;
  reviewer: string;
  identType: string;
  checkType: string;
  
  // 2. KYC- & Regulatorische Grundkonformität
  kyc_gwg: string;
  kyc_method: string;
  kyc_consent: string;
  kyc_role: string;
  kyc_purpose: string;
  
  // 3. Ablauf & Prozesskonformität
  process_complete: string;
  process_order: string;
  process_guidance: string;
  process_problems: string;
  process_traceable: string;
  
  // 4. Ident- & Dokumentenprüfung
  doc_validity: string;
  doc_sides: string;
  doc_security: string;
  doc_tilted: string;
  doc_manipulation: string;
  doc_match: string;
  
  // 5. Lebendigkeits- & Betrugsprävention
  liveness_active: string;
  liveness_spontaneous: string;
  liveness_deepfake: string;
  liveness_thirdparty: string;
  liveness_reaction: string;
  
  // 6. Technische Handhabung
  tech_camera: string;
  tech_quality: string;
  tech_shortcuts: string;
  tech_saved: string;
  tech_errors: string;
  
  // 7. Kommunikation & Auftreten
  comm_greeting: string;
  comm_clear: string;
  comm_neutral: string;
  comm_patient: string;
  comm_privacy: string;
  
  // 8. Entscheidungsqualität
  decision_correct: string;
  decision_risk: string;
  decision_nopassthrough: string;
  decision_documented: string;
  decision_escalation: string;
  
  // 9. Dokumentation
  doc_fields: string;
  doc_media: string;
  doc_time: string;
  doc_issues: string;
  doc_abort: string;
  
  // 10. Gesamtbewertung
  overall_rating: string;
  result: string;
  risk_level: string;
  risk_reason: string;
  
  // 11. Maßnahmen & Feedback
  positive_feedback: string;
  negative_feedback: string;
  training_needed: string;
  training_areas: string[];
  additional_notes: string;
  
  // AutoIdent spezifische Felder
  auto_doc_scan_quality: string;
  auto_doc_readable: string;
  auto_doc_complete: string;
  auto_face_scan_quality: string;
  auto_face_match: string;
  auto_environment_ok: string;
  auto_lighting_ok: string;
  auto_no_obstruction: string;
  auto_process_completed: string;
  auto_system_decision: string;
  auto_manual_review_needed: string;
  [key: string]: string | string[];
}

// Moved OUTSIDE the component to prevent re-creation on every render (cursor loss fix)
const SectionHeader = ({ number, icon: Icon, title }: { number: number; icon: any; title: string }) => (
  <CardHeader className="pb-4">
    <CardTitle className="flex items-center gap-3 text-lg">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary text-sm font-bold">
        {number}
      </div>
      <Icon className="h-5 w-5 text-primary/70" />
      <span>{title}</span>
    </CardTitle>
  </CardHeader>
);

const TableHeader = () => (
  <thead>
    <tr className="bg-muted/50">
      <th className="border-b border-border p-3.5 text-left text-sm font-semibold text-foreground">Prüffrage</th>
      <th className="border-b border-border p-3.5 text-center w-16 text-sm font-semibold text-foreground">Ja</th>
      <th className="border-b border-border p-3.5 text-center w-16 text-sm font-semibold text-foreground">Nein</th>
      <th className="border-b border-border p-3.5 text-center w-24 text-sm font-semibold text-foreground">Unbekannt</th>
      <th className="border-b border-border p-3.5 text-left w-48 text-sm font-semibold text-foreground">Bemerkung</th>
    </tr>
  </thead>
);

const RadioQuestion = ({ 
  label, 
  field,
  formData,
  onRadioChange,
  onInputChange,
}: { 
  label: string; 
  field: keyof QualityCheckData;
  formData: QualityCheckData;
  onRadioChange: (field: keyof QualityCheckData, value: string) => void;
  onInputChange: (field: keyof QualityCheckData, value: string) => void;
}) => (
  <tr className="group hover:bg-muted/30 transition-colors">
    <td className="border-b border-border/50 p-3.5 text-sm text-foreground">{label}</td>
    <td className="border-b border-border/50 p-3.5 text-center">
      <RadioGroup
        value={formData[field] as string}
        onValueChange={(value) => onRadioChange(field, value)}
        className="flex justify-center"
      >
        <RadioGroupItem value="ja" className="border-primary/40" />
      </RadioGroup>
    </td>
    <td className="border-b border-border/50 p-3.5 text-center">
      <RadioGroup
        value={formData[field] as string}
        onValueChange={(value) => onRadioChange(field, value)}
        className="flex justify-center"
      >
        <RadioGroupItem value="nein" className="border-primary/40" />
      </RadioGroup>
    </td>
    <td className="border-b border-border/50 p-3.5 text-center">
      <RadioGroup
        value={formData[field] as string}
        onValueChange={(value) => onRadioChange(field, value)}
        className="flex justify-center"
      >
        <RadioGroupItem value="unbekannt" className="border-primary/40" />
      </RadioGroup>
    </td>
    <td className="border-b border-border/50 p-3.5">
      <Input
        placeholder="Bemerkung"
        className="text-sm h-9 bg-background/50 border-border/50 focus:border-primary/50"
        value={(formData[`${field}_note` as keyof QualityCheckData] as string) || ""}
        onChange={(e) => onInputChange(`${field}_note` as keyof QualityCheckData, e.target.value)}
      />
    </td>
  </tr>
);

const TaskQualityCheck = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [hasUploadSteps, setHasUploadSteps] = useState(false);
  const [submission, setSubmission] = useState<{ status: string | null; admin_data: any | null } | null>(null);
  const navigate = useNavigate();
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittingRef = useRef(false);
  
  const [formData, setFormData] = useState<QualityCheckData>({
    date: new Date().toISOString().split('T')[0],
    sessionId: "",
    identAgent: "",
    reviewer: "",
    identType: "",
    checkType: "",
    
    kyc_gwg: "",
    kyc_method: "",
    kyc_consent: "",
    kyc_role: "",
    kyc_purpose: "",
    
    process_complete: "",
    process_order: "",
    process_guidance: "",
    process_problems: "",
    process_traceable: "",
    
    doc_validity: "",
    doc_sides: "",
    doc_security: "",
    doc_tilted: "",
    doc_manipulation: "",
    doc_match: "",
    
    liveness_active: "",
    liveness_spontaneous: "",
    liveness_deepfake: "",
    liveness_thirdparty: "",
    liveness_reaction: "",
    
    tech_camera: "",
    tech_quality: "",
    tech_shortcuts: "",
    tech_saved: "",
    tech_errors: "",
    
    comm_greeting: "",
    comm_clear: "",
    comm_neutral: "",
    comm_patient: "",
    comm_privacy: "",
    
    decision_correct: "",
    decision_risk: "",
    decision_nopassthrough: "",
    decision_documented: "",
    decision_escalation: "",
    
    doc_fields: "",
    doc_media: "",
    doc_time: "",
    doc_issues: "",
    doc_abort: "",
    
    overall_rating: "",
    result: "",
    risk_level: "",
    risk_reason: "",
    
    positive_feedback: "",
    negative_feedback: "",
    training_needed: "",
    training_areas: [],
    additional_notes: "",
    
    // AutoIdent spezifische Felder
    auto_doc_scan_quality: "",
    auto_doc_readable: "",
    auto_doc_complete: "",
    auto_face_scan_quality: "",
    auto_face_match: "",
    auto_environment_ok: "",
    auto_lighting_ok: "",
    auto_no_obstruction: "",
    auto_process_completed: "",
    auto_system_decision: "",
    auto_manual_review_needed: ""
  });

  const isAutoIdent = formData.identType === "autoident";

  useEffect(() => {
    checkAuthAndFetchData();
  }, [taskId]);

  // Auto-save effect with debounce
  useEffect(() => {
    if (loading || !task) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveData();
    }, 2000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, loading, task]);

  const checkAuthAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    if (!taskId) {
      navigate("/dashboard/tasks");
      return;
    }

    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("id, title, description, steps")
      .eq("id", taskId)
      .eq("assigned_to", session.user.id)
      .single();

    if (taskError || !taskData) {
      console.error("Error fetching task:", taskError);
      toast.error("Auftrag nicht gefunden");
      navigate("/dashboard/tasks");
      return;
    }

    setTask(taskData);
    
    const steps = Array.isArray(taskData.steps) ? taskData.steps : [];
    const hasUploads = steps.some((step: any) => step.type === "file");
    setHasUploadSteps(hasUploads);

    const { data: submissionData } = await supabase
      .from("task_submissions")
      .select("status, admin_data, step_responses")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    setSubmission(submissionData || null);

    // Postversand-Bereitschaft prüfen: Wenn Mitarbeiter "Nein" geantwortet hat,
    // werden Upload-Schritte ignoriert und der Auftrag direkt abgeschlossen.
    const stepResponses = (submissionData?.step_responses as any[]) || [];
    const postalDeclined = steps.some((s: any) =>
      s.ask_postal_consent &&
      stepResponses.find((r: any) => r.step_id === s.id)?.postal_consent === "no"
    );
    if (postalDeclined && hasUploads) {
      setHasUploadSteps(false);
    }

    const adminData = submissionData?.admin_data as any;

    // Prüfe ob Benutzer Zugang hat
    // - Normal: nur nach abgeschlossenem KYC (kyc_completed) oder wenn bereits eingereicht (awaiting_review)
    // - Bei Admin-Ablehnung: status kann "in_progress" sein, Quality-Check muss dann wieder bearbeitbar sein
    // - Bei Tasks OHNE Checkbox (kein KYC-Flow): in_progress ist erlaubt
    const isRejectedRevision = !!(adminData?.rejection_timestamp || adminData?.restart_from_step);
    const isKycStepCompleted = submissionData?.status === "kyc_completed" || !!adminData?.kyc_completed;
    const hasCheckboxSteps = steps.some((step: any) => step.type === "checkbox");
    const isNonKycTask = !hasCheckboxSteps; // Tasks ohne Checkbox brauchen keinen KYC-Flow
    
    const canAccess = !!submissionData && (
      isKycStepCompleted ||
      submissionData.status === "awaiting_review" ||
      (submissionData.status === "in_progress" && isRejectedRevision) ||
      (submissionData.status === "in_progress" && isNonKycTask)
    );

    if (!canAccess) {
      // Kein setLoading(false) vor navigate - Komponente wird sowieso unmountet
      navigate(`/dashboard/tasks/${taskId}/demo-data`, { replace: true });
      return;
    }
    
    // Erlaubt auch Zugang ohne Submission bei Non-KYC Tasks
    if (!submissionData && !isNonKycTask) {
      // Kein setLoading(false) vor navigate - Komponente wird sowieso unmountet
      navigate(`/dashboard/tasks/${taskId}/demo-data`, { replace: true });
      return;
    }

    // Wenn Quality Check bereits abgeschlossen ist UND es Upload-Schritte gibt, weiterleiten.
    // ABER: Bei Ablehnung/Rework NICHT automatisch weiterleiten, sonst kommt man nicht mehr ins Formular.
    if (!isRejectedRevision && adminData?.quality_check_completed_at) {
      const steps = Array.isArray(taskData.steps) ? taskData.steps : [];
      const rawHasUploads = steps.some((step: any) => step.type === "file");
      // Postversand übersprungen, wenn Mitarbeiter "Nein" gewählt hat
      const hasUploads = rawHasUploads && !postalDeclined;

      // Produkttest folgt direkt nach dem Fragebogen
      const pendingProductTest = await getPendingProductTestStep(taskId!, taskData.steps);
      if (pendingProductTest) {
        navigate(`/dashboard/tasks/${taskId}/product-test`, { replace: true });
        return;
      }

      if (hasUploads && !adminData?.postal_documents_completed) {
        toast.info("Qualitätsprüfung bereits abgeschlossen. Weiter zum Postversand.");
        navigate(`/dashboard/tasks/${taskId}/postal-documents-check`, { replace: true });
        return;
      } else if (!hasUploads) {
        toast.info("Qualitätsprüfung bereits abgeschlossen.");
        navigate(`/dashboard/tasks/${taskId}/submitted`, { replace: true });
        return;
      }
    }


    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.user.id)
      .single();
    
    if (profile) {
      const identCode = adminData?.ident_code || "";
      
      setFormData(prev => ({
        ...prev,
        identAgent: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        sessionId: identCode
      }));
    }

    // Lade gespeicherte Quality Check Daten wenn vorhanden
    if (adminData?.quality_check) {
      setFormData(prev => ({ ...prev, ...adminData.quality_check }));
    }

    setLoading(false);
  };

  const autoSaveData = async () => {
    if (submittingRef.current) return;
    setAutoSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const existingAdmin = (existingSubmission?.admin_data as any) || {};

    if (submittingRef.current) {
      setAutoSaving(false);
      return;
    }

    const { error } = await supabase
      .from("task_submissions")
      .update({ 
        admin_data: {
          ...existingAdmin,
          quality_check: formData,
        } as any
      })
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id);

    if (!error) {
      setLastSaved(new Date());
    }

    setAutoSaving(false);
  };

  const handleRadioChange = (field: keyof QualityCheckData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (field: keyof QualityCheckData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTrainingAreaToggle = (area: string) => {
    setFormData(prev => ({
      ...prev,
      training_areas: prev.training_areas.includes(area)
        ? prev.training_areas.filter(a => a !== area)
        : [...prev.training_areas, area]
    }));
  };

  const handleSubmit = async () => {
    // All fields are optional

    submittingRef.current = true;
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      submittingRef.current = false;
      navigate("/auth");
      return;
    }

    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const existingAdmin = (existingSubmission?.admin_data as any) || {};
    const completedAt = new Date().toISOString();
    const mergedAdminData = {
      ...existingAdmin,
      quality_check: formData as any,
      completed_at: completedAt,
      quality_check_completed_at: completedAt,
      last_section: "quality_check",
    } as any;

    const { data: taskData } = await supabase
      .from("tasks")
      .select("steps")
      .eq("id", taskId)
      .single();

    const { data: submissionForPostal } = await supabase
      .from("task_submissions")
      .select("step_responses")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const steps = taskData?.steps as any[] || [];
    const stepResponses = (submissionForPostal?.step_responses as any[]) || [];
    const postalDeclined = steps.some((s: any) =>
      s.ask_postal_consent &&
      stepResponses.find((r: any) => r.step_id === s.id)?.postal_consent === "no"
    );
    const hasUploadSteps = !postalDeclined && steps.some((step: any) => step.type === "file");




    // Produkttest folgt direkt nach dem Fragebogen – vorher nicht zur Prüfung einreichen
    const pendingProductTest = await getPendingProductTestStep(taskId!, steps);

    const updateData: any = { admin_data: mergedAdminData };
    if (!hasUploadSteps && !pendingProductTest) {
      updateData.status = "awaiting_review";
      updateData.submitted_at = new Date().toISOString();
    }

    const { error: submissionError } = await supabase
      .from("task_submissions")
      .update(updateData)
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id);

    if (submissionError) {
      console.error("Error saving quality check:", submissionError);
      toast.error("Fehler beim Speichern");
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    if (pendingProductTest) {
      toast.success("Bewertungsprotokoll eingereicht. Weiter zum Produkttest.");
      navigate(`/dashboard/tasks/${taskId}/product-test`);
    } else if (hasUploadSteps) {
      toast.success("Bewertungsprotokoll eingereicht. Bitte füllen Sie nun das Unterlagen-Protokoll aus.");
      navigate(`/dashboard/tasks/${taskId}/postal-documents-check`);
    } else {
      toast.success("Bewertungsprotokoll erfolgreich eingereicht und zur Prüfung weitergeleitet");
      navigate(`/dashboard/tasks/${taskId}/submitted`);
    }
  };


  if (loading) {
    return <PageLoader />;
  }


  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Breadcrumb */}
        <motion.div
          className="flex items-center gap-2 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Dashboard
          </Button>
          <span className="text-muted-foreground">/</span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/tasks")} className="text-muted-foreground hover:text-foreground">
            Aufträge
          </Button>
        </motion.div>

        {/* Header Card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-l-4 border-l-primary overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <motion.div
                    className="mt-1"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Shield className="h-7 w-7 text-primary" />
                  </motion.div>
                  <div>
                    <CardTitle className="text-xl md:text-2xl mb-1.5">
                      {isAutoIdent 
                        ? "Qualitätsprüfung – AutoIdent-Prozess" 
                        : "Qualitätsprüfung – KYC & Video-Ident-Prozess"
                      }
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {isAutoIdent 
                        ? "Automatisierte Identitätsprüfung – Ausweis-Scan & Gesichtserkennung"
                        : "Gültig für VideoIdent / AutoIdent / Hybrid – z. B. WebID, IDnow"
                      }
                    </CardDescription>
                    <CardDescription className="mt-0.5 text-sm">Checkliste für: <span className="font-medium text-foreground">{task?.title}</span></CardDescription>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {autoSaving && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Speichert...
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/10 px-4 py-3">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Füllen Sie die Checkliste nach bestem Wissen und Gewissen aus. Es gibt keine falschen Antworten – Ihre ehrliche Einschätzung zählt. Felder, die Sie nicht beurteilen können, dürfen Sie mit „Unbekannt" markieren oder leer lassen.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Auftrags-Aktionen: Komplett beenden / Fortschritt zurücksetzen */}
        {taskId && <TaskActionsBar taskId={taskId} />}

        {/* Art des Vorgangs */}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-l-4 border-l-accent">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-accent/10">
                  <GitBranch className="h-4 w-4 text-accent-foreground" />
                </div>
                Art des Vorgangs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.identType}
                onValueChange={(value) => handleInputChange('identType', value)}
                className="flex flex-wrap gap-3"
              >
                {[
                  { value: "liveident", icon: Video, label: "LiveIdent" },
                  { value: "autoident", icon: Smartphone, label: "AutoIdent" },
                  { value: "hybrid", icon: GitBranch, label: "Hybrid" },
                ].map(({ value, icon: Icon, label }) => (
                  <div key={value} className={`flex items-center space-x-2.5 rounded-xl px-5 py-2.5 border transition-all cursor-pointer ${formData.identType === value ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-background hover:border-primary/30'}`}>
                    <RadioGroupItem value={value} id={value} />
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={value} className="cursor-pointer font-medium">{label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>
        </motion.div>

        {/* 1. Allgemeine Angaben */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card>
            <SectionHeader number={1} icon={ClipboardList} title="Allgemeine Angaben" />
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Datum der Prüfung</Label>
                  <Input type="date" value={formData.date} onChange={(e) => handleInputChange('date', e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Geprüfter Vorgang / Session-ID</Label>
                  <Input value={formData.sessionId} onChange={(e) => handleInputChange('sessionId', e.target.value)} className="bg-background/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Prüfer (QS / KYC / Compliance)</Label>
                  <Input value={formData.reviewer} onChange={(e) => handleInputChange('reviewer', e.target.value)} className="bg-background/50" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Prüfungsart</Label>
                <RadioGroup value={formData.checkType} onValueChange={(value) => handleInputChange('checkType', value)} className="flex gap-4 mt-1.5">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="stichprobe" id="stichprobe" />
                    <Label htmlFor="stichprobe">Stichprobe</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="anlassbezogen" id="anlassbezogen" />
                    <Label htmlFor="anlassbezogen">Anlassbezogen (Auffälligkeit / Reklamation / Audit)</Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Formular-Wechsel mit Animation */}
        <div className={`space-y-5 transition-all duration-500 ease-in-out ${isAutoIdent ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-none'}`}>
          {/* 2. KYC- & Regulatorische Grundkonformität */}
          <Card>
            <SectionHeader number={2} icon={Shield} title="KYC- & Regulatorische Grundkonformität" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Vorgang gemäß GwG & interner KYC-Richtlinie durchgeführt?" field="kyc_gwg" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Richtige Ident-Methode verwendet?" field="kyc_method" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Datenschutz & Einwilligungen korrekt eingeholt?" field="kyc_consent" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Rollenabgrenzung eingehalten (keine Beratung)?" field="kyc_role" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="KYC-Zweck klar eingehalten (Ident ≠ Kontoentscheidung)?" field="kyc_purpose" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 3. Ablauf & Prozesskonformität */}
          <Card>
            <SectionHeader number={3} icon={Settings} title="Ablauf & Prozesskonformität" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Prozess vollständig & ohne Abkürzungen durchgeführt?" field="process_complete" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Reihenfolge der Ident-Schritte eingehalten?" field="process_order" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Kunde verständlich durch den Prozess geführt?" field="process_guidance" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Bei Problemen angemessen reagiert (Erklärung / Wiederholung)?" field="process_problems" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Ablauf insgesamt nachvollziehbar?" field="process_traceable" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 4. Ident- & Dokumentenprüfung */}
          <Card>
            <SectionHeader number={4} icon={FileText} title="Ident- & Dokumentenprüfung" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Gültigkeit des Ausweises geprüft?" field="doc_validity" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Vorder- und Rückseite geprüft?" field="doc_sides" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Sicherheitsmerkmale aktiv eingefordert (Hologramm etc.)?" field="doc_security" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Ausweis gekippt / gedreht?" field="doc_tilted" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Zustand & Manipulation geprüft?" field="doc_manipulation" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Person ↔ Ausweis plausibel abgeglichen?" field="doc_match" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 5. Lebendigkeits- & Betrugsprävention */}
          <Card>
            <SectionHeader number={5} icon={User} title="Lebendigkeits- & Betrugsprävention" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Aktive Lebendigkeitsprüfung durchgeführt?" field="liveness_active" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Spontane Reaktionen eingefordert?" field="liveness_spontaneous" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Keine Hinweise auf Aufzeichnung / Deepfake?" field="liveness_deepfake" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Drittpersonen ausgeschlossen?" field="liveness_thirdparty" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Bei Auffälligkeiten korrekt reagiert?" field="liveness_reaction" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AutoIdent spezifisches Formular */}
        <div className={`space-y-5 transition-all duration-500 ease-in-out ${isAutoIdent ? 'opacity-100 max-h-none' : 'opacity-0 max-h-0 overflow-hidden'}`}>
          {/* AutoIdent: Ausweis-Scan Qualität */}
           <Card>
            <SectionHeader number={0} icon={Smartphone} title="Ausweis-Scan Qualität" />
            <CardContent className="pt-0 pb-2">
              <p className="text-sm text-muted-foreground mb-4">Prüfung der automatischen Dokumentenerfassung</p>
            </CardContent>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Scan-Qualität ausreichend (scharf, korrekt belichtet)?" field="auto_doc_scan_quality" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Alle Dokumentenfelder lesbar erfasst?" field="auto_doc_readable" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Vorder- und Rückseite vollständig gescannt?" field="auto_doc_complete" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AutoIdent: Gesichtserkennung & Umgebung */}
          <Card>
            <SectionHeader number={0} icon={User} title="Gesichtserkennung & Umgebung" />
            <CardContent className="pt-0 pb-2">
              <p className="text-sm text-muted-foreground mb-4">Prüfung des Selfie-Scans und der Aufnahmeumgebung</p>
            </CardContent>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Gesichtsaufnahme in ausreichender Qualität?" field="auto_face_scan_quality" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Gesicht ↔ Ausweis-Foto plausibel übereinstimmend?" field="auto_face_match" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Umgebung neutral und störungsfrei?" field="auto_environment_ok" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Beleuchtung ausreichend (kein Gegenlicht, Schatten)?" field="auto_lighting_ok" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Keine Verdeckungen im Gesicht (Brille ggf. entfernt)?" field="auto_no_obstruction" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* AutoIdent: Prozess & System-Entscheidung */}
          <Card>
            <SectionHeader number={0} icon={Cog} title="Prozess & System-Entscheidung" />
            <CardContent className="pt-0 pb-2">
              <p className="text-sm text-muted-foreground mb-4">Prüfung des automatisierten Ident-Ablaufs</p>
            </CardContent>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="AutoIdent-Prozess vollständig durchlaufen?" field="auto_process_completed" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="System-Entscheidung nachvollziehbar dokumentiert?" field="auto_system_decision" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Manuelle Nachprüfung erforderlich?" field="auto_manual_review_needed" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Info-Hinweis für AutoIdent */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <span className="text-2xl">ℹ️</span>
                <div>
                  <p className="font-medium text-foreground">AutoIdent-Besonderheiten</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bei AutoIdent entfallen agentenbasierte Prüfpunkte wie Live-Kommunikation, spontane Reaktionen und 
                    manuelle Lebendigkeitsprüfung. Der Fokus liegt auf der technischen Qualität der Scans und der 
                    automatisierten Gesichtserkennung.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Video-Ident spezifische Abschnitte - ausgeblendet bei AutoIdent */}
        <div className={`space-y-5 transition-all duration-500 ease-in-out ${isAutoIdent ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-none'}`}>
          {/* 6. Technische Handhabung */}
          <Card>
            <SectionHeader number={6} icon={Video} title="Technische Handhabung" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Kamera & System korrekt genutzt?" field="tech_camera" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Bild- & Tonqualität ausreichend?" field="tech_quality" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Keine technischen Abkürzungen?" field="tech_shortcuts" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Aufzeichnungen korrekt gespeichert?" field="tech_saved" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Technische Fehler korrekt gehandhabt?" field="tech_errors" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 7. Kommunikation & Auftreten */}
          <Card>
            <SectionHeader number={7} icon={MessageSquare} title="Kommunikation & Auftreten" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Freundliche & professionelle Begrüßung?" field="comm_greeting" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Ruhige, klare Anweisungen?" field="comm_clear" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Neutralität gewahrt (keine Zusagen / Prognosen)?" field="comm_neutral" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Geduldig bei Rückfragen / Problemen?" field="comm_patient" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Datenschutz & Zweck korrekt erklärt?" field="comm_privacy" />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 8. Entscheidungsqualität - nur bei Video-Ident */}
        <div className={`space-y-5 transition-all duration-500 ease-in-out ${isAutoIdent ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100 max-h-none'}`}>
          <Card>
            <SectionHeader number={8} icon={Scale} title="Entscheidungsqualität" />
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <TableHeader />
                  <tbody>
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Entscheidung regelkonform getroffen?" field="decision_correct" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Entscheidung risikoadäquat?" field="decision_risk" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label='Kein „Durchwinken" trotz Unsicherheit?' field="decision_nopassthrough" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Entscheidung nachvollziehbar begründet?" field="decision_documented" />
                    <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Bei Unsicherheit korrekt eskaliert / übergeben?" field="decision_escalation" />
                  </tbody>
                </table>
              </div>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  ➡️ <strong>Hinweis:</strong> ✔️ Erfolgreiches Ident <strong>oder</strong> ✔️ sauber begründeter Abbruch = <strong>positives KYC-Ergebnis</strong>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 9. Dokumentation */}
        <Card>
          <SectionHeader number={9} icon={ClipboardList} title="Dokumentation" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <TableHeader />
                <tbody>
                  <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Alle Pflichtfelder ausgefüllt?" field="doc_fields" />
                  <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Screenshots / Videos vollständig & verwertbar?" field="doc_media" />
                  <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Zeitaufwand plausibel?" field="doc_time" />
                  <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Auffälligkeiten dokumentiert?" field="doc_issues" />
                  <RadioQuestion formData={formData} onRadioChange={handleRadioChange} onInputChange={handleInputChange} label="Abbruch / Sonderfall begründet?" field="doc_abort" />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 10. Gesamtbewertung */}
        <Card>
          <SectionHeader number={10} icon={Star} title="Gesamtbewertung" />
          <CardContent className="space-y-6">
            <div>
              <Label className="font-semibold">Gesamteindruck</Label>
              <RadioGroup
                value={formData.overall_rating}
                onValueChange={(value) => handleInputChange('overall_rating', value)}
                className="flex flex-wrap gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sehr_gut" id="sehr_gut" />
                  <Label htmlFor="sehr_gut">Sehr gut</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gut" id="gut" />
                  <Label htmlFor="gut">Gut</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ausreichend" id="ausreichend" />
                  <Label htmlFor="ausreichend">Ausreichend</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="verbesserungsbeduerftig" id="verbesserungsbeduerftig" />
                  <Label htmlFor="verbesserungsbeduerftig">Verbesserungsbedürftig</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="font-semibold">Ergebnis</Label>
              <RadioGroup
                value={formData.result}
                onValueChange={(value) => handleInputChange('result', value)}
                className="flex flex-wrap gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bestanden" id="bestanden" />
                  <Label htmlFor="bestanden">✅ Bestanden</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nicht_bestanden" id="nicht_bestanden" />
                  <Label htmlFor="nicht_bestanden">❌ Nicht bestanden</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nachschulung" id="nachschulung" />
                  <Label htmlFor="nachschulung">📚 Nachschulung empfohlen</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="font-semibold">Risikoeinschätzung des Vorgangs</Label>
              <RadioGroup
                value={formData.risk_level}
                onValueChange={(value) => handleInputChange('risk_level', value)}
                className="flex flex-wrap gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="niedrig" id="risk_niedrig" />
                  <Label htmlFor="risk_niedrig">🟢 Niedrig</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mittel" id="risk_mittel" />
                  <Label htmlFor="risk_mittel">🟡 Mittel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="hoch" id="risk_hoch" />
                  <Label htmlFor="risk_hoch">🔴 Hoch</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="font-semibold">Begründung der Risikoeinschätzung</Label>
              <Textarea
                value={formData.risk_reason}
                onChange={(e) => handleInputChange('risk_reason', e.target.value)}
                placeholder="Begründung eingeben..."
                className="mt-2"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* 11. Maßnahmen & Feedback */}
        <Card>
          <SectionHeader number={11} icon={Wrench} title="Maßnahmen & Feedback" />
          <CardContent className="space-y-4">
            <div>
              <Label className="font-semibold">Positives Verhalten / Stärken</Label>
              <Textarea
                value={formData.positive_feedback}
                onChange={(e) => handleInputChange('positive_feedback', e.target.value)}
                placeholder="Beschreiben Sie positive Aspekte..."
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label className="font-semibold">Auffälligkeiten / Schwächen</Label>
              <Textarea
                value={formData.negative_feedback}
                onChange={(e) => handleInputChange('negative_feedback', e.target.value)}
                placeholder="Beschreiben Sie Verbesserungspotenziale..."
                className="mt-2"
                rows={3}
              />
            </div>

            <div>
              <Label className="font-semibold">Schulungsbedarf</Label>
              <RadioGroup
                value={formData.training_needed}
                onValueChange={(value) => handleInputChange('training_needed', value)}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ja" id="training_ja" />
                  <Label htmlFor="training_ja">Ja</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nein" id="training_nein" />
                  <Label htmlFor="training_nein">Nein</Label>
                </div>
              </RadioGroup>
            </div>

            {formData.training_needed === "ja" && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <Label className="font-semibold">Schulungsbereiche:</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {[
                    "Dokumentenprüfung",
                    "Lebendigkeitsprüfung",
                    "Entscheidungsfindung / Abbruch",
                    "Kommunikation & Neutralität",
                    "Technische Handhabung"
                  ].map((area) => (
                    <div key={area} className="flex items-center space-x-2">
                      <Checkbox
                        id={`training_${area}`}
                        checked={formData.training_areas.includes(area)}
                        onCheckedChange={() => handleTrainingAreaToggle(area)}
                      />
                      <Label htmlFor={`training_${area}`} className="font-normal">{area}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="font-semibold">Zusätzliche Bemerkungen</Label>
              <Textarea
                value={formData.additional_notes}
                onChange={(e) => handleInputChange('additional_notes', e.target.value)}
                placeholder="Weitere Anmerkungen..."
                className="mt-2"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Abschluss Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Dieser Qualitätsbogen dient der:</p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Sicherstellung der <strong>KYC- & AML-Compliance</strong></li>
                    <li>kontinuierlichen <strong>Qualitätsverbesserung</strong></li>
                    <li>revisionssicheren <strong>Dokumentation</strong></li>
                    <li>fairen & objektiven <strong>Agentenbewertung</strong></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-12 text-base"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Qualitätsprüfung abschließen
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default TaskQualityCheck;
