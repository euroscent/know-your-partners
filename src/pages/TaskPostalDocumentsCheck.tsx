import { useEffect, useState, useRef } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Check, FileText, Mail, Search, FolderOpen, FileCheck2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/lib/toast-stub";

interface Task {
  id: string;
  title: string;
  description: string | null;
  steps: any;
}

interface PostalDocumentsData {
  // General information
  date: string;
  employee: string;
  process_number: string;
  client_bank: string;
  
  // Section 2: Receipt of documents
  from_client_confirmed: string;
  from_client_remarks: string;
  receipt_time_documented: string;
  receipt_time_remarks: string;
  documents_complete: string;
  documents_complete_remarks: string;
  correct_assignment: string;
  correct_assignment_remarks: string;
  documents_undamaged: string;
  documents_undamaged_remarks: string;
  
  // Section 3: Shipping duration
  shipping_duration_documented: string;
  shipping_duration_documented_remarks: string;
  shipping_duration_plausible: string;
  shipping_duration_plausible_remarks: string;
  deviation_noted: string;
  deviation_noted_remarks: string;
  
  // Section 4: Security fields
  security_features_present: string;
  security_features_present_remarks: string;
  security_features_verified: string;
  security_features_verified_remarks: string;
  no_manipulation: string;
  no_manipulation_remarks: string;
  missing_features_noted: string;
  missing_features_noted_remarks: string;
  
  // Section 5: Content review
  customer_data_matches: string;
  customer_data_matches_remarks: string;
  contract_data_complete: string;
  contract_data_complete_remarks: string;
  signatures_present: string;
  signatures_present_remarks: string;
  no_contradictions: string;
  no_contradictions_remarks: string;
  
  // Section 6: Further processing
  sent_to_correct_recipient: string;
  sent_to_correct_recipient_remarks: string;
  secure_transmission: string;
  secure_transmission_remarks: string;
  transfer_time_documented: string;
  transfer_time_documented_remarks: string;
  receipt_confirmed: string;
  receipt_confirmed_remarks: string;
  no_local_storage: string;
  no_local_storage_remarks: string;
  
  // Section 7: Data protection
  stored_in_authorized_system: string;
  stored_in_authorized_system_remarks: string;
  no_unauthorized_disclosure: string;
  no_unauthorized_disclosure_remarks: string;
  retention_periods_met: string;
  retention_periods_met_remarks: string;
  privacy_check_documented: string;
  privacy_check_documented_remarks: string;
  
  // Section 8: Deviations & escalation
  missing_documents_reported: string;
  missing_documents_reported_remarks: string;
  forgery_suspicion_forwarded: string;
  forgery_suspicion_forwarded_remarks: string;
  deviations_documented: string;
  deviations_documented_remarks: string;
  
  // Section 9: Final control
  process_fully_documented: string;
  process_fully_documented_remarks: string;
  status_updated: string;
  status_updated_remarks: string;
  reviewer_signature: string;
  reviewer_signature_remarks: string;
  
  // Section 10: Additional remarks
  additional_remarks: string;
}

const TaskPostalDocumentsCheck = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [formData, setFormData] = useState<PostalDocumentsData>({
    date: new Date().toISOString().split('T')[0],
    employee: "",
    process_number: "",
    client_bank: "",
    from_client_confirmed: "",
    from_client_remarks: "",
    receipt_time_documented: "",
    receipt_time_remarks: "",
    documents_complete: "",
    documents_complete_remarks: "",
    correct_assignment: "",
    correct_assignment_remarks: "",
    documents_undamaged: "",
    documents_undamaged_remarks: "",
    shipping_duration_documented: "",
    shipping_duration_documented_remarks: "",
    shipping_duration_plausible: "",
    shipping_duration_plausible_remarks: "",
    deviation_noted: "",
    deviation_noted_remarks: "",
    security_features_present: "",
    security_features_present_remarks: "",
    security_features_verified: "",
    security_features_verified_remarks: "",
    no_manipulation: "",
    no_manipulation_remarks: "",
    missing_features_noted: "",
    missing_features_noted_remarks: "",
    customer_data_matches: "",
    customer_data_matches_remarks: "",
    contract_data_complete: "",
    contract_data_complete_remarks: "",
    signatures_present: "",
    signatures_present_remarks: "",
    no_contradictions: "",
    no_contradictions_remarks: "",
    sent_to_correct_recipient: "",
    sent_to_correct_recipient_remarks: "",
    secure_transmission: "",
    secure_transmission_remarks: "",
    transfer_time_documented: "",
    transfer_time_documented_remarks: "",
    receipt_confirmed: "",
    receipt_confirmed_remarks: "",
    no_local_storage: "",
    no_local_storage_remarks: "",
    stored_in_authorized_system: "",
    stored_in_authorized_system_remarks: "",
    no_unauthorized_disclosure: "",
    no_unauthorized_disclosure_remarks: "",
    retention_periods_met: "",
    retention_periods_met_remarks: "",
    privacy_check_documented: "",
    privacy_check_documented_remarks: "",
    missing_documents_reported: "",
    missing_documents_reported_remarks: "",
    forgery_suspicion_forwarded: "",
    forgery_suspicion_forwarded_remarks: "",
    deviations_documented: "",
    deviations_documented_remarks: "",
    process_fully_documented: "",
    process_fully_documented_remarks: "",
    status_updated: "",
    status_updated_remarks: "",
    reviewer_signature: "",
    reviewer_signature_remarks: "",
    additional_remarks: "",
  });

  useEffect(() => {
    fetchTaskAndSubmission();
  }, [taskId]);

  // Auto-save effect with debounce
  useEffect(() => {
    // Don't auto-save on initial load
    if (loading || !task) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveData();
    }, 2000);

    // Cleanup on unmount
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, loading, task]);

  const fetchTaskAndSubmission = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Fetch task
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

    // Fetch existing submission
    const { data: submissionData } = await supabase
      .from("task_submissions")
      .select("admin_data, status")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const adminData = (submissionData?.admin_data as any) || {};
    const steps = (taskData.steps as any[]) || [];
    const isRestartingFromUpload = adminData.restart_from_step && 
      steps.some((s: any) => s.id === adminData.restart_from_step && s.type === "file");

    // Guard: Postal Documents Check erst nach KYC UND Quality Check erlaubt
    // ABER: Wenn restart_from_step auf einen Upload-Schritt zeigt, erlaube Zugriff
    if (!isRestartingFromUpload) {
      if (!submissionData || (submissionData.status !== "kyc_completed" && !adminData.kyc_completed)) {
        console.log("[DEBUG] Postal documents check not accessible: status =", submissionData?.status);
        toast.error("Bitte schließen Sie zuerst KYC und Qualitätsprüfung ab");
        // Kein setLoading(false) - Komponente wird durch navigate unmountet
        navigate(`/dashboard/tasks/${taskId}/demo-data`, { replace: true });
        return;
      }

      // Prüfe ob Quality Check abgeschlossen wurde (Formular eingereicht)
      if (!adminData.quality_check) {
        console.log("[DEBUG] Quality check not completed yet");
        toast.error("Bitte schließen Sie zuerst die Qualitätsprüfung ab");
        // Kein setLoading(false) - Komponente wird durch navigate unmountet
        navigate(`/dashboard/tasks/${taskId}/quality-check`, { replace: true });
        return;
      }
    }

    // Wenn Postal Documents bereits abgeschlossen ist, zum Upload weiterleiten
    if (adminData.postal_documents_completed) {
      toast.info("Unterlagen-Protokoll bereits abgeschlossen. Weiter zum Upload.");
      // Kein setLoading(false) - Komponente wird durch navigate unmountet
      navigate(`/dashboard/tasks/${taskId}?section=uploads`, { replace: true });
      return;
    }

    // Load existing postal documents data if available
    if (adminData.postal_documents_check) {
      setFormData(prev => ({ ...prev, ...adminData.postal_documents_check }));
    }

    // Mark this section as last visited so reopening the task returns here
    await supabase
      .from("task_submissions")
      .update({
        admin_data: { ...adminData, last_section: "postal_documents_check" } as any,
      })
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id);

    // Fetch user profile for employee name
    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setFormData(prev => ({
        ...prev,
        employee: `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim()
      }));
    }

    setLoading(false);
  };

  const autoSaveData = async () => {
    setAutoSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Get existing admin_data
    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .single();

    const existingAdminData = (existingSubmission?.admin_data as any) || {};

    // Save data without changing step or completion status
    const { error } = await supabase
      .from("task_submissions")
      .update({ 
        admin_data: {
          ...existingAdminData,
          postal_documents_check: formData,
          last_section: "postal_documents_check",
        } as any
      })
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id);

    if (!error) {
      setLastSaved(new Date());
    }

    setAutoSaving(false);
  };

  const handleRadioChange = (field: keyof PostalDocumentsData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleInputChange = (field: keyof PostalDocumentsData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Get existing admin_data
    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .single();

    const existingAdminData = (existingSubmission?.admin_data as any) || {};

    // Check if task has upload steps
    const steps = ((task as any)?.steps as any[]) || [];
    const hasUploadSteps = steps.some((s: any) => s?.type === "file");

    if (!hasUploadSteps) {
      // No upload steps - go directly to quality check
      const { error: submissionError } = await supabase
        .from("task_submissions")
        .update({ 
          status: "awaiting_review",
          admin_data: {
            ...existingAdminData,
            postal_documents_check: formData,
            postal_documents_completed: true,
            postal_documents_completed_at: new Date().toISOString(),
            last_section: "quality_check",
          } as any
        })
        .eq("task_id", taskId)
        .eq("employee_id", session.user.id);

      if (submissionError) {
        console.error("Error saving postal documents check:", submissionError);
        toast.error("Fehler beim Speichern");
        setSubmitting(false);
        return;
      }

      toast.success("Unterlagen-Protokoll erfolgreich eingereicht. Weiter zur Qualitätsprüfung.");
      navigate(`/dashboard/tasks/${taskId}/quality-check`);
      return;
    }

    // Has upload steps - find the correct upload step to restart from
    const restartStepId = existingAdminData.restart_from_step;
    let targetIndex = 0;
    
    if (restartStepId) {
      // Find the specific step that was marked for restart
      const restartIndex = steps.findIndex((s: any) => s.id === restartStepId);
      if (restartIndex !== -1) {
        targetIndex = restartIndex;
      } else {
        // Fallback to first upload if restart step not found
        const firstUploadIndex = steps.findIndex((s: any) => s?.type === "file");
        targetIndex = firstUploadIndex !== -1 ? firstUploadIndex : 0;
      }
    } else {
      // No restart - find first upload step
      const firstUploadIndex = steps.findIndex((s: any) => s?.type === "file");
      targetIndex = firstUploadIndex !== -1 ? firstUploadIndex : 0;
    }

    // Update task submission with protocol + save progress
    const { error: submissionError } = await supabase
      .from("task_submissions")
      .update({ 
        status: "in_progress",
        admin_data: {
          ...existingAdminData,
          postal_documents_check: formData,
          postal_documents_completed: true,
          postal_documents_completed_at: new Date().toISOString(),
          current_step_index: targetIndex,
          last_section: "uploads",
          restart_from_step: null,
        } as any
      })
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id);

    if (submissionError) {
      console.error("Error saving postal documents check:", submissionError);
      toast.error("Fehler beim Speichern");
      setSubmitting(false);
      return;
    }

    toast.success("Unterlagen-Protokoll erfolgreich eingereicht. Bitte laden Sie nun die erforderlichen Dokumente hoch.");
    navigate(`/dashboard/tasks/${taskId}?section=uploads`);
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Auftrag nicht gefunden</p>
      </div>
    );
  }

  const RadioQuestion = ({ 
    label, 
    field, 
    remarksField 
  }: { 
    label: string; 
    field: keyof PostalDocumentsData; 
    remarksField: keyof PostalDocumentsData;
  }) => (
    <div className="border-b pb-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <Label className="text-sm font-medium">{label}</Label>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field}
              value="ja"
              checked={formData[field] === "ja"}
              onChange={(e) => handleRadioChange(field, e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Ja</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field}
              value="nein"
              checked={formData[field] === "nein"}
              onChange={(e) => handleRadioChange(field, e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Nein</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={field}
              value="unbekannt"
              checked={formData[field] === "unbekannt"}
              onChange={(e) => handleRadioChange(field, e.target.value)}
              className="w-4 h-4"
            />
            <span className="text-sm">Unbekannt</span>
          </label>
        </div>
      </div>
      <div className="mt-3">
        <Input
          type="text"
          placeholder="Bemerkung"
          value={formData[remarksField] as string}
          onChange={(e) => handleInputChange(remarksField, e.target.value)}
          className="text-sm"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <span className="text-muted-foreground">/</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/tasks")}
          >
            Aufträge
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="relative bg-gradient-to-br from-primary/5 via-primary/10 to-accent/10 pb-8 min-h-[220px] md:min-h-[260px]">
            {/* Animated illustration scene – documents, letters, magnifying glass */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {/* Large folder (back) */}
              <motion.div
                className="absolute right-[8%] bottom-[10%] text-primary/40"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, -2, 2, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
              >
                <FolderOpen className="h-24 w-24 md:h-32 md:w-32" strokeWidth={1} />
              </motion.div>

              {/* Documents / papers behind folder */}
              <motion.div
                className="absolute right-[18%] bottom-[18%] text-muted-foreground/30"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              >
                <FileText className="h-16 w-16 md:h-20 md:w-20" strokeWidth={1.2} />
              </motion.div>

              {/* Second document page offset */}
              <motion.div
                className="absolute right-[3%] bottom-[30%] text-muted-foreground/20"
                animate={{ y: [0, -4, 0], rotate: [3, 5, 3] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <FileCheck2 className="h-14 w-14 md:h-18 md:w-18" strokeWidth={1} />
              </motion.div>

              {/* Letter / envelope */}
              <motion.div
                className="absolute left-[5%] bottom-[12%] text-destructive/30"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0, y: [0, -8, 0], rotate: [-5, 0, -5] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                <Mail className="h-16 w-16 md:h-20 md:w-20" strokeWidth={1.2} />
              </motion.div>

              {/* Second small letter */}
              <motion.div
                className="absolute left-[18%] top-[15%] text-destructive/20"
                animate={{ y: [0, -6, 0], rotate: [8, 12, 8] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
              >
                <Mail className="h-10 w-10 md:h-12 md:w-12" strokeWidth={1.5} />
              </motion.div>

              {/* Magnifying glass – prominent, animated */}
              <motion.div
                className="absolute right-[30%] bottom-[5%] text-primary/40"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [0.95, 1.05, 0.95],
                  rotate: [-15, -10, -15],
                  x: [0, 8, 0],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
              >
                <Search className="h-20 w-20 md:h-28 md:w-28" strokeWidth={1.2} />
              </motion.div>

              {/* Small floating sparkle dots */}
              {[
                { left: "40%", top: "20%", delay: 0 },
                { left: "60%", top: "35%", delay: 1.2 },
                { left: "25%", top: "50%", delay: 2.4 },
              ].map((dot, i) => (
                <motion.div
                  key={i}
                  className="absolute h-2 w-2 rounded-full bg-primary/20"
                  style={{ left: dot.left, top: dot.top }}
                  animate={{ scale: [0, 1, 0], opacity: [0, 0.5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: dot.delay }}
                />
              ))}
            </div>

            <div className="relative z-10 flex items-start justify-between gap-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <CardTitle className="text-2xl mb-2 flex items-center gap-3">
                  <motion.span
                    className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 backdrop-blur-sm"
                    animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.06, 1] }}
                    transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <FolderOpen className="h-6 w-6 text-primary" />
                  </motion.span>
                  <span>Checkliste – Prüfung von Bankunterlagen nach Identifikation</span>
                </CardTitle>
                <CardDescription>Protokoll für {task?.title}</CardDescription>
              </motion.div>
              <div className="flex flex-col items-end gap-2 relative z-10">
                <Badge variant="outline" className="backdrop-blur-sm">Postalische Unterlagen</Badge>
                {autoSaving && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full" />
                    Speichert...
                  </div>
                )}
                {!autoSaving && lastSaved && (
                  <div className="flex items-center gap-1 text-sm text-foreground/70">
                    <Check className="h-3 w-3 text-primary" />
                    Gespeichert
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10 p-5">
              <div className="flex items-start gap-3">
                <motion.div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary"
                  animate={{ y: [0, -6, 0], rotate: [0, -6, 6, 0] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Mail className="h-5 w-5" />
                </motion.div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-3">Hinweis zu postalischen Unterlagen</h4>
                  <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                    <p>
                      In den kommenden Tagen erhalten Sie Unterlagen per Post im Rahmen eines internen Test- und Evaluierungsverfahrens.
                      Diese Unterlagen stammen vom Auftraggeber der Bank, dienen jedoch ausschließlich zu Schulungs-, Test- oder Evaluationszwecken.
                    </p>
                    <p>
                      <strong className="text-foreground">Alle Dokumente und Daten sind generiert (Demo-Daten) und nicht echt.</strong> Sie müssen keine Aktivierung und keine reale Verarbeitung durchführen.
                    </p>
                    <p>
                      Ziel dieser Übung ist es, die Bearbeitung, Dokumentation und Prozessqualität zu überprüfen so, wie sie im echten Arbeitsablauf erfolgen würde.
                      Bitte behandeln Sie die Unterlagen dennoch vertraulich und arbeiten Sie die Checkliste sorgfältig durch, als wäre es ein echter Vorgang.
                    </p>
                    <p className="pt-2 border-t border-border">
                      <strong className="text-foreground">Wichtig:</strong> Sie können zunächst in diesem Schritt verbleiben und die Seite schließen, bis keine Unterlagen mehr eingetroffen sind.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 1: General Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">1. Allgemeine Angaben</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="date">Datum</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="employee">Mitarbeiter</Label>
                <Input
                  id="employee"
                  type="text"
                  value={formData.employee}
                  onChange={(e) => handleInputChange('employee', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="process_number">Vorgangsnummer / Session-ID</Label>
                <Input
                  id="process_number"
                  type="text"
                  value={formData.process_number}
                  onChange={(e) => handleInputChange('process_number', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="client_bank">Auftraggeber (Bank)</Label>
                <Input
                  id="client_bank"
                  type="text"
                  value={formData.client_bank}
                  onChange={(e) => handleInputChange('client_bank', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Receipt of documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Eingang der Unterlagen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Unterlagen stammen eindeutig vom Auftraggeber (Bank)?"
              field="from_client_confirmed"
              remarksField="from_client_remarks"
            />
            <RadioQuestion 
              label="Empfangszeitpunkt dokumentiert (Datum / Uhrzeit)?"
              field="receipt_time_documented"
              remarksField="receipt_time_remarks"
            />
            <RadioQuestion 
              label="Unterlagen vollständig gemäß Auftrag?"
              field="documents_complete"
              remarksField="documents_complete_remarks"
            />
            <RadioQuestion 
              label="Richtige Zuordnung zum Ident-Vorgang (ID, Kundennummer)?"
              field="correct_assignment"
              remarksField="correct_assignment_remarks"
            />
            <RadioQuestion 
              label="Unterlagen unbeschädigt / unverändert eingegangen?"
              field="documents_undamaged"
              remarksField="documents_undamaged_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 3: Shipping duration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">3. Versanddauer / Prozesszeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Versanddauer zwischen Ident-Abschluss und Dokumenteneingang dokumentiert?"
              field="shipping_duration_documented"
              remarksField="shipping_duration_documented_remarks"
            />
            <RadioQuestion 
              label="Versanddauer plausibel (innerhalb erwarteter Frist)?"
              field="shipping_duration_plausible"
              remarksField="shipping_duration_plausible_remarks"
            />
            <RadioQuestion 
              label="Abweichung (z. B. verspätet, fehlend) im System notiert?"
              field="deviation_noted"
              remarksField="deviation_noted_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 4: Security fields */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">4. Sicherheits- und Vertrauensfelder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Dokumente enthalten Sicherheitsmerkmale (Wasserzeichen, digitale Signatur etc.)?"
              field="security_features_present"
              remarksField="security_features_present_remarks"
            />
            <RadioQuestion 
              label="Sicherheitsfelder / Signaturen überprüft?"
              field="security_features_verified"
              remarksField="security_features_verified_remarks"
            />
            <RadioQuestion 
              label="Keine Hinweise auf Manipulation oder Fälschung?"
              field="no_manipulation"
              remarksField="no_manipulation_remarks"
            />
            <RadioQuestion 
              label="Bei fehlenden Sicherheitsmerkmalen Hinweis im Protokoll vermerkt?"
              field="missing_features_noted"
              remarksField="missing_features_noted_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 5: Content review */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">5. Inhaltliche Prüfung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Kundendaten stimmen mit Ident-Ergebnis überein?"
              field="customer_data_matches"
              remarksField="customer_data_matches_remarks"
            />
            <RadioQuestion 
              label="Vertragsdaten vollständig und plausibel?"
              field="contract_data_complete"
              remarksField="contract_data_complete_remarks"
            />
            <RadioQuestion 
              label="Unterschriften vorhanden und lesbar (falls nötig)?"
              field="signatures_present"
              remarksField="signatures_present_remarks"
            />
            <RadioQuestion 
              label="Keine widersprüchlichen Angaben im Vergleich zum Ident-Protokoll?"
              field="no_contradictions"
              remarksField="no_contradictions_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 6: Further processing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">6. Weiterverarbeitung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Unterlagen an richtigen Empfänger / System übermittelt?"
              field="sent_to_correct_recipient"
              remarksField="sent_to_correct_recipient_remarks"
            />
            <RadioQuestion 
              label="Übertragung über sicheren Kanal (z. B. verschlüsselter Upload)?"
              field="secure_transmission"
              remarksField="secure_transmission_remarks"
            />
            <RadioQuestion 
              label="Übergabezeitpunkt dokumentiert?"
              field="transfer_time_documented"
              remarksField="transfer_time_documented_remarks"
            />
            <RadioQuestion 
              label="Empfang durch Auftraggeber bestätigt?"
              field="receipt_confirmed"
              remarksField="receipt_confirmed_remarks"
            />
            <RadioQuestion 
              label="Keine lokale Speicherung oder Ausdrucke erstellt?"
              field="no_local_storage"
              remarksField="no_local_storage_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 7: Data protection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">7. Datenschutz & Archivierung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Unterlagen nur im autorisierten System gespeichert?"
              field="stored_in_authorized_system"
              remarksField="stored_in_authorized_system_remarks"
            />
            <RadioQuestion 
              label="Keine Datenweitergabe an Unbefugte?"
              field="no_unauthorized_disclosure"
              remarksField="no_unauthorized_disclosure_remarks"
            />
            <RadioQuestion 
              label="Aufbewahrungs- und Löschfristen eingehalten?"
              field="retention_periods_met"
              remarksField="retention_periods_met_remarks"
            />
            <RadioQuestion 
              label="Datenschutzprüfung im System dokumentiert?"
              field="privacy_check_documented"
              remarksField="privacy_check_documented_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 8: Deviations & escalation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">8. Abweichungen & Eskalation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Fehlende oder fehlerhafte Unterlagen gemeldet?"
              field="missing_documents_reported"
              remarksField="missing_documents_reported_remarks"
            />
            <RadioQuestion 
              label="Verdacht auf Fälschung / Manipulation weitergeleitet?"
              field="forgery_suspicion_forwarded"
              remarksField="forgery_suspicion_forwarded_remarks"
            />
            <RadioQuestion 
              label="Abweichungen schriftlich dokumentiert (Datum, Art, Reaktion)?"
              field="deviations_documented"
              remarksField="deviations_documented_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 9: Final control */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">9. Abschlusskontrolle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioQuestion 
              label="Vorgang vollständig dokumentiert?"
              field="process_fully_documented"
              remarksField="process_fully_documented_remarks"
            />
            <RadioQuestion 
              label='Status im System aktualisiert ("Unterlagen geprüft")?'
              field="status_updated"
              remarksField="status_updated_remarks"
            />
            <RadioQuestion 
              label="Prüfer-Signatur / Datum eingetragen?"
              field="reviewer_signature"
              remarksField="reviewer_signature_remarks"
            />
          </CardContent>
        </Card>

        {/* Section 10: Additional remarks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">10. Bemerkungen / Hinweise</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Weitere Bemerkungen oder Hinweise..."
              value={formData.additional_remarks}
              onChange={(e) => handleInputChange('additional_remarks', e.target.value)}
              rows={6}
              className="w-full"
            />
          </CardContent>
        </Card>

        {/* Submit button */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <LoadingButton 
                onClick={handleSubmit} 
                loading={submitting}
                loadingText="Wird gespeichert..."
                size="lg"
              >
                Protokoll Einreichen
              </LoadingButton>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskPostalDocumentsCheck;
