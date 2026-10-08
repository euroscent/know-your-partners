import { useEffect, useState, useRef } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, CheckCircle2, Upload, XCircle, Camera, Scissors, FileText, Mail, Search, ShieldAlert, BookOpen, CreditCard, Trash2, Eye, Sun, FileCheck, HardDrive, Loader2, FolderOpen, Euro, Clock, Timer, Sparkles } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { BankingChecklist } from "@/components/BankingChecklist";
import { CredentialsBadge } from "@/components/CredentialsBadge";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { TaskImageRotator } from "@/components/TaskImageRotator";
import { TaskActionsBar } from "@/components/TaskActionsBar";
import { getBannerUrls } from "@/lib/taskUtils";
import { motion, AnimatePresence } from "framer-motion";

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const stepTransition = {
  type: "tween" as const,
  ease: "easeInOut" as const,
  duration: 0.3
};

interface TaskStep {
  ask_id_document?: boolean;
  id_document_options?: ("personalausweis" | "reisepass")[];
  id_document_bonus?: { personalausweis?: number; reisepass?: number };
  ask_postal_consent?: boolean;
  postal_consent_bonus?: number;
  id: string;
  title: string;
  description: string;
  type: "text" | "checkbox" | "file";
  required: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  steps: TaskStep[];
  due_date: string | null;
  estimated_hours: number | null;
  compensation_amount?: number | null;
  image_url?: string | null;
  images?: unknown;
  logo_url?: string | null;
  primary_color?: string | null;
  deadline_days?: number | null;
  updated_at?: string | null;
  task_type?: string | null;
}

interface StepResponse {
  step_id: string;
  value: string | boolean;
  file_url?: string;
  file_urls?: Array<{ url: string; name: string; uploaded_at: string }>;
  id_document?: string;
  postal_consent?: "yes" | "no";
}

// ============= HELPER FUNCTIONS: MODULE DETECTION =============
const hasKycModule = (steps: TaskStep[]) => steps.some(s => s.type === "checkbox");
const hasUploadModule = (steps: TaskStep[]) => steps.some(s => s.type === "file");
const hasOnlyTextSteps = (steps: TaskStep[]) => steps.every(s => s.type === "text");

const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, StepResponse>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string | null>(null);
  const [persistedAdminData, setPersistedAdminData] = useState<any>(null);
  const [isFreelancer, setIsFreelancer] = useState(false);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const originalStepsRef = useRef<TaskStep[] | null>(null);

  // ============= POSTAL CONSENT GATE FOR FILE STEPS =============
  // Wenn der Mitarbeiter bei einem "ask_postal_consent"-Schritt mit "Nein" antwortet,
  // werden alle Datei-Upload-Schritte aus dem Flow entfernt (auch wenn in der Vorlage definiert).
  useEffect(() => {
    if (!task || !originalStepsRef.current) return;
    const original = originalStepsRef.current;
    const postalDeclined = original.some(
      (s) =>
        s.type === "text" &&
        (s as any).ask_postal_consent &&
        responses[s.id]?.postal_consent === "no"
    );
    const desired = postalDeclined
      ? original.filter((s) => s.type !== "file")
      : original;
    if (desired.length !== task.steps.length) {
      setTask({ ...task, steps: desired } as any);
      // Falls aktueller Index nun außerhalb liegt, auf letzten gültigen Step setzen
      if (currentStepIndex >= desired.length) {
        setCurrentStepIndex(Math.max(0, desired.length - 1));
      }
    }
  }, [responses, task, currentStepIndex]);

  // Load banner images when task changes
  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    getBannerUrls(task as any).then((urls) => {
      if (!cancelled) setBannerUrls(urls);
    });
    return () => { cancelled = true; };
  }, [task?.id, task?.updated_at]);

  // Helper function to log employee activity
  const logActivity = async (activityType: string, stepIndex?: number, metadata: any = {}) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !task) return;

      const step = stepIndex !== undefined ? task.steps[stepIndex] : null;
      
      await supabase.from('activity_logs').insert({
        user_id: session.user.id,
        task_id: taskId,
        activity_type: activityType,
        step_index: stepIndex,
        step_title: step?.title || null,
        metadata: metadata,
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw, logging is non-critical
    }
  };

  useEffect(() => {
    checkAuthAndFetchTask();
  }, [taskId]);

  // Log activity when step changes
  useEffect(() => {
    if (task && !loading) {
      logActivity('step_view', currentStepIndex);
    }
  }, [currentStepIndex, task, loading]);

  // Persist aktueller Schritt beim Verlassen der Seite
  // NOTE: Only run on beforeunload, not on every state change to avoid loops
  useEffect(() => {
    const persistOnUnload = () => {
      // Only save if we have meaningful data
      if (task && Object.keys(responses).length > 0) {
        saveProgress();
      }
    };

    window.addEventListener('beforeunload', persistOnUnload);
    return () => {
      window.removeEventListener('beforeunload', persistOnUnload);
    };
  }, []); // Empty deps - only set up listener once

  // NOTE: URL-based step switching is now handled in checkAuthAndFetchTask (PRIORITY 0)
  // This effect is REMOVED to prevent state update loops when persistedAdminData changes.

  const checkAuthAndFetchTask = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const redirect = `${location.pathname}${location.search}${location.hash}`;
      try {
        sessionStorage.setItem("postLoginRedirect", redirect);
      } catch {
        // ignore
      }
      navigate(`/login?redirect=${encodeURIComponent(redirect)}`, { replace: true });
      return;
    }

    if (!taskId) {
      navigate("/dashboard/tasks");
      return;
    }

    // Determine whether the current user is a freelancer (drives compensation visibility)
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("employment_type, verified, resource_assignment_approved")
        .eq("id", session.user.id)
        .maybeSingle();
      const empType = (profile?.employment_type || "").toLowerCase();
      setIsFreelancer(empType === "freelancer" || empType === "freelance");

      // Block task access until admin has approved resource assignment
      if (profile?.verified && !profile?.resource_assignment_approved) {
        toast.error("Bitte schließen Sie zuerst die Ressourcenzuweisung ab.");
        navigate("/dashboard", { replace: true });
        return;
      }
    } catch {
      // ignore - non-critical
    }

    // Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("id, step_responses, status, checklist_completed, checklist_data, admin_data, notes")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    // Store submission status for display
    if (existingSubmission) {
      setSubmissionStatus(existingSubmission.status);
      // Zeige Ablehnungsgrund wenn notes vorhanden (bei in_progress mit notes = abgelehnt)
      if (existingSubmission.notes) {
        setRejectionNotes(existingSubmission.notes);
      }
      setPersistedAdminData((existingSubmission as any).admin_data || null);
    }
    
    // Fetch task first
    const { data: taskData, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .eq("assigned_to", session.user.id)
      .single();

    if (taskError || !taskData) {
      console.error("Error fetching task:", taskError);
      toast.error("Auftrag nicht gefunden");
      navigate("/dashboard/tasks");
      return;
    }

    const rawSteps = (taskData as any).steps as TaskStep[];

    // ============= POSTAL CONSENT GATE (initial load) =============
    // Wenn der Mitarbeiter bereits "Nein" zur postalischen Zusendung gespeichert hat,
    // entfernen wir alle Datei-Upload-Schritte direkt beim Laden, damit Routing/Navigation
    // gar nicht erst zur Upload-Phase springt.
    const persistedResponses = (existingSubmission?.step_responses as any[]) || [];
    const postalDeclinedInitial = rawSteps.some(
      (s: any) =>
        s.ask_postal_consent &&
        persistedResponses.find((r: any) => r?.step_id === s.id)?.postal_consent === "no"
    );
    const steps: TaskStep[] = postalDeclinedInitial
      ? rawSteps.filter((s) => s.type !== "file")
      : rawSteps;

    setTask({ ...(taskData as any), steps });
    originalStepsRef.current = rawSteps;
    const adminData = (existingSubmission?.admin_data as any) || {};

    // ============= MODULE DETECTION =============
    const kycModule = hasKycModule(steps);

    const uploadModule = hasUploadModule(steps);
    
    // ============= PRIORITY 0: RESPECT URL SECTION PARAM =============
    // If URL explicitly says ?section=uploads, skip all navigation logic and stay on upload step
    const urlParams = new URLSearchParams(location.search);
    const forceUploadsFromUrl = urlParams.get('section') === 'uploads';
    
    if (forceUploadsFromUrl && uploadModule) {
      // Load existing responses
      if (existingSubmission?.step_responses) {
        const stepResponses = existingSubmission.step_responses as any[];
        const responsesMap: Record<string, StepResponse> = {};
        stepResponses.forEach((resp: any) => {
          responsesMap[resp.step_id] = resp;
        });
        setResponses(responsesMap);
      }
      
      // Find saved step index or first upload step
      const savedIdx = typeof adminData.current_step_index === 'number' ? adminData.current_step_index : -1;
      const firstUploadIndex = steps.findIndex((step: TaskStep) => step.type === "file");
      const targetIndex = (savedIdx >= 0 && steps[savedIdx]?.type === "file") ? savedIdx : firstUploadIndex;
      
      if (targetIndex !== -1) {
        setCurrentStepIndex(targetIndex);
        const postalDone = !!(adminData.postal_documents_completed || adminData.postal_documents_completed_at);
        setChecklistCompleted(postalDone);
        setShowChecklist(!postalDone);
      }
      
      setLoading(false);
      return; // Skip all other navigation logic
    }
    
    // ============= PRIORITY 1: REJECTION & RESTART =============
    if (adminData.restart_from_step) {
      const restartStepId = adminData.restart_from_step as string;
      const restartStepIndex = steps.findIndex((step: TaskStep) => step.id === restartStepId);

      if (restartStepIndex === -1) {
        // Restart-Schritt nicht gefunden - zeige Warnung und starte vom Anfang
        console.error("Restart step not found:", restartStepId);
        toast.error("Der angegebene Restart-Schritt wurde nicht gefunden. Starte vom Anfang.");
        
        await supabase
          .from("task_submissions")
          .update({
            status: "in_progress",
            admin_data: {
              ...adminData,
              current_step_index: 0,
              restart_from_step: null,
              last_section: null,
              quality_check: null,
              completed_at: null,
            } as any,
          })
          .eq("id", existingSubmission!.id);
        
        if (existingSubmission?.notes) {
          toast.error(`Aufgabe abgelehnt: ${existingSubmission.notes}`, { duration: 8000 });
        }
        
        // Load existing responses
        if (existingSubmission?.step_responses) {
          const stepResponses = existingSubmission.step_responses as any[];
          const responsesMap: Record<string, StepResponse> = {};
          stepResponses.forEach((resp: any) => {
            responsesMap[resp.step_id] = resp;
          });
          setResponses(responsesMap);
        }
        
        setCurrentStepIndex(0);
        setLoading(false);
        return;
      }

      if (restartStepIndex !== -1) {
        const restartStep = steps[restartStepIndex];
        
        // Upload-Schritt -> Upload-Modul Neustart (Postalprotokoll)
        if (restartStep.type === "file") {
          await supabase
            .from("task_submissions")
            .update({
              admin_data: {
                ...adminData,
                postal_documents_completed: false,
                restart_from_step: restartStepId,
              } as any,
            })
            .eq("id", existingSubmission!.id);
          
          navigate(`/dashboard/tasks/${taskId}/postal-documents-check`);
          return;
        }

        // Text-Schritt -> Direkt zum Schritt navigieren
        if (restartStep.type === "text") {
          await supabase
            .from("task_submissions")
            .update({
              status: "in_progress",
              admin_data: {
                ...adminData,
                current_step_index: restartStepIndex,
                restart_from_step: null,
                // Navigation-State zurücksetzen damit nicht direkt zum Quality-Check gesprungen wird
                last_section: null,
                quality_check: null,
                completed_at: null,
              } as any,
            })
            .eq("id", existingSubmission!.id);
          
          if (existingSubmission?.notes) {
            toast.error(`Aufgabe abgelehnt: ${existingSubmission.notes}`, { duration: 8000 });
          }

          // Load existing responses
          if (existingSubmission?.step_responses) {
            const stepResponses = existingSubmission.step_responses as any[];
            const responsesMap: Record<string, StepResponse> = {};
            stepResponses.forEach((resp: any) => {
              responsesMap[resp.step_id] = resp;
            });
            setResponses(responsesMap);
          }
          
          setCurrentStepIndex(restartStepIndex);
          setLoading(false);
          return;
        }

        // Checkbox-Schritt (KYC) -> Bei Ablehnung IMMER KYC wiederholen lassen
        // WICHTIG: Wenn Admin explizit auf KYC-Schritt zurücksetzt, muss KYC wiederholt werden
        // unabhängig davon ob der Nutzer bereits verifiziert ist
        if (restartStep.type === "checkbox" && kycModule) {
          const identCodesArr = Array.isArray(adminData.ident_codes) ? adminData.ident_codes.filter((c: any) => typeof c === 'string' && c.trim()) : [];
          const hasDemoDataForRestart = !!(adminData.email || adminData.phone || adminData.password || adminData.ident_code || identCodesArr.length > 0 || adminData.ident_link || adminData.image_url || adminData.passcode);
          
          // Wenn Admin bereits neue Demo-Daten ergänzt hat (Status in_progress),
          // restart_from_step löschen und direkt zur Demo-Data Seite
          if (existingSubmission?.status === "in_progress" && hasDemoDataForRestart) {
            await supabase
              .from("task_submissions")
              .update({
                admin_data: {
                  ...adminData,
                  current_step_index: restartStepIndex,
                  restart_from_step: null,
                  last_section: null,
                  quality_check: null,
                  completed_at: null,
                } as any,
              })
              .eq("id", existingSubmission!.id);
            
            navigate(`/dashboard/tasks/${taskId}/demo-data`);
            return;
          }
          
          // Noch keine neuen Demo-Daten: Status auf pending setzen
          await supabase
            .from("task_submissions")
            .update({
              status: "pending",
              admin_data: {
                ...adminData,
                current_step_index: restartStepIndex,
                last_section: null,
                quality_check: null,
                completed_at: null,
              } as any,
            })
            .eq("id", existingSubmission!.id);
          
          if (existingSubmission?.notes) {
            toast.error(`Aufgabe abgelehnt: ${existingSubmission.notes}`, { duration: 8000 });
          }
          
          navigate(`/dashboard/tasks/${taskId}/demo-data`);
          return;
        }
      }
    }

    // ============= SAFETY CHECK: VALIDATE STEP INDEX FOR in_progress =============
    // If status is in_progress but current_step_index is missing/invalid, find first incomplete required step
    // This prevents skipping to end when admin_data is reset but last_section is still set
    const stepIndexIsValid = typeof adminData.current_step_index === 'number' 
      && adminData.current_step_index >= 0 
      && adminData.current_step_index < steps.length;
    
    if (existingSubmission?.status === "in_progress" && !stepIndexIsValid) {
      // Load responses to find first incomplete step
      let safetyResponsesMap: Record<string, StepResponse> = {};
      if (existingSubmission?.step_responses) {
        const stepResponses = existingSubmission.step_responses as any[];
        stepResponses.forEach((resp: any) => {
          safetyResponsesMap[resp.step_id] = resp;
        });
      }
      setResponses(safetyResponsesMap);
      
      // Find first incomplete required step
      let firstIncomplete = 0;
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const resp = safetyResponsesMap[step.id];
        
        if (step.required) {
          if (step.type === "checkbox" || step.type === "text") {
            if (!resp || resp.value !== true) {
              firstIncomplete = i;
              break;
            }
          } else if (step.type === "file") {
            if (!resp || !resp.file_urls || resp.file_urls.length === 0) {
              firstIncomplete = i;
              break;
            }
          }
        }
        // If we checked all steps and none incomplete, stay at last checked
        if (i === steps.length - 1) {
          firstIncomplete = 0; // Default to first step if all complete (shouldn't happen for in_progress)
        }
      }
      
      console.warn(`Safety check: step_index invalid for in_progress, resetting to step ${firstIncomplete}`);
      setCurrentStepIndex(firstIncomplete);
      
      // Update the database with corrected step index and clear last_section
      if (existingSubmission?.id) {
        await supabase
          .from("task_submissions")
          .update({
            admin_data: {
              ...adminData,
              current_step_index: firstIncomplete,
              last_section: null, // Clear to prevent loop
            } as any,
          })
          .eq("id", existingSubmission.id);
      }
      
      setLoading(false);
      return;
    }
    
    // ============= PRIORITY 2: UNDER REVIEW =============
    if (existingSubmission?.status === "awaiting_review" || existingSubmission?.status === "in_review") {
      if (existingSubmission?.step_responses) {
        const stepResponses = existingSubmission.step_responses as any[];
        const responsesMap: Record<string, StepResponse> = {};
        stepResponses.forEach((resp: any) => {
          responsesMap[resp.step_id] = resp;
        });
        setResponses(responsesMap);
      }
      setLoading(false);
      return;
    }
    
    // ============= PRIORITY 3: MODULE-BASED NAVIGATION =============
    
    // Status variables (needed throughout)
    const kycPending = existingSubmission?.status === "pending";
    const kycCompleted = existingSubmission?.status === "kyc_completed" || !!adminData.kyc_completed;
    // Quality-Check zählt als abgeschlossen, sobald das Formular eingereicht wurde.
    const qcRaw = adminData.quality_check as Record<string, any> | null | undefined;
    const qcIgnoreKeys = new Set(['date', 'sessionId', 'identAgent', 'reviewer']);
    const hasQualityCheck = !!(
      adminData.quality_check_completed_at ||
      adminData.completed_at ||
      (qcRaw && typeof qcRaw === 'object' && (
        qcRaw.completed_at ||
        Object.entries(qcRaw).some(([k, v]) => {
          if (qcIgnoreKeys.has(k)) return false;
          if (typeof v === 'string') return v.trim() !== '';
          if (Array.isArray(v)) return v.length > 0;
          if (typeof v === 'boolean') return v === true;
          if (typeof v === 'number') return true;
          return false;
        })
      ))
    );
    const postalCompleted = !!(adminData.postal_documents_completed_at || adminData.postal_documents_completed);
    
    // Find the index of the first non-text step
    const firstNonTextStepIndex = steps.findIndex((step: TaskStep) => step.type !== "text");
    const savedStepIndex = typeof adminData.current_step_index === 'number' ? adminData.current_step_index : 0;
    
    // If we haven't completed text steps yet, stay on TaskDetail to show them
    const hasTextSteps = steps.some((step: TaskStep) => step.type === "text");
    const hasCompletedTextSteps = firstNonTextStepIndex === -1 || savedStepIndex >= firstNonTextStepIndex;
    
    // Only navigate away if text steps are completed
    if (!hasTextSteps || hasCompletedTextSteps) {
      // Check if demo data is present (admin provided data like email, phone, etc.)
      const identCodesArr2 = Array.isArray(adminData.ident_codes) ? adminData.ident_codes.filter((c: any) => typeof c === 'string' && c.trim()) : [];
      const hasDemoData = !!(adminData.email || adminData.phone || adminData.password || adminData.ident_code || identCodesArr2.length > 0 || adminData.ident_link || adminData.image_url || adminData.passcode);
      
      // KYC Module: Pending -> Demo Data Page
      if (kycModule && kycPending && !hasQualityCheck) {
        navigate(`/dashboard/tasks/${taskId}/demo-data`);
        return;
      }
      
      // KYC Module: In Progress WITH demo data -> Demo Data Page (to show data and proceed with KYC)
      // This handles the case where admin added demo data and status changed to in_progress
      if (kycModule && existingSubmission?.status === "in_progress" && hasDemoData && !kycCompleted && !hasQualityCheck) {
        navigate(`/dashboard/tasks/${taskId}/demo-data`);
        return;
      }
      
      // KYC Module: Completed -> Quality Check (if not yet done)
      if (kycModule && kycCompleted && !hasQualityCheck) {
        navigate(`/dashboard/tasks/${taskId}/quality-check`);
        return;
      }
      
      // KYC Module: Completed + Quality Check done -> show Quality Check page (for review/confirmation)
      // This handles the case where user returns to this task after completing Quality Check
      if (kycModule && kycCompleted && hasQualityCheck && !uploadModule) {
        navigate(`/dashboard/tasks/${taskId}/quality-check`);
        return;
      }
      
      // Upload Module: Nach Qualitätsprotokoll (falls KYC vorhanden) -> Postalisches Protokoll, solange nicht erledigt
      if (uploadModule && !postalCompleted) {
        const shouldShowPostal = kycModule ? hasQualityCheck : true;
        if (shouldShowPostal) {
          navigate(`/dashboard/tasks/${taskId}/postal-documents-check`);
          return;
        }
      }

      // Only restore last_section after KYC/demo-data routing was evaluated.
      const lastSection = adminData.last_section;
      if (lastSection === "postal_documents_check") {
        navigate(`/dashboard/tasks/${taskId}/postal-documents-check`);
        return;
      }
      if (lastSection === "quality_check") {
        navigate(`/dashboard/tasks/${taskId}/quality-check`);
        return;
      }
      if (lastSection === "uploads") {
        const firstUploadIndex = steps.findIndex((step: TaskStep) => step.type === "file");
        if (firstUploadIndex !== -1) {
          setCurrentStepIndex(firstUploadIndex);
          setLoading(false);
          return;
        }
      }
    }

    // ============= LOAD EXISTING RESPONSES =============
    if (existingSubmission?.step_responses) {
      const stepResponses = existingSubmission.step_responses as any[];
      const responsesMap: Record<string, StepResponse> = {};
      stepResponses.forEach((resp: any) => {
        responsesMap[resp.step_id] = resp;
      });
      setResponses(responsesMap);
    }

    // Read forced section from URL
    const sectionParams = new URLSearchParams(location.search);
    const forceUploads = sectionParams.get('section') === 'uploads';

    // ============= SET CURRENT STEP INDEX =============
    // Priority 1: Force uploads via URL
    if (forceUploads && uploadModule) {
      const firstUploadIndex = steps.findIndex((step: TaskStep) => step.type === "file");
      if (firstUploadIndex !== -1) {
        setCurrentStepIndex(firstUploadIndex);
        setChecklistCompleted(!!postalCompleted);
        setShowChecklist(!postalCompleted);
        setLoading(false);
        return;
      }
    }

    // Priority 2: If postal completed, go to first upload step
    if (uploadModule && postalCompleted) {
      const firstUploadIndex = steps.findIndex((step: TaskStep) => step.type === "file");
      if (firstUploadIndex !== -1) {
        setCurrentStepIndex(firstUploadIndex);
        const checklistNeeded = !(existingSubmission?.checklist_completed || postalCompleted);
        if (checklistNeeded) {
          setShowChecklist(true);
          setChecklistCompleted(false);
        } else {
          setChecklistCompleted(true);
          setShowChecklist(false);
        }
        setLoading(false);
        return;
      }
    }

    // Priority 3: Otherwise, use saved step index - but validate all prior steps are complete
    const savedIndexRaw = adminData.current_step_index;
    const savedIndex = typeof savedIndexRaw === 'number' ? savedIndexRaw : undefined;
    
    // Load responses first to validate
    let responsesMap: Record<string, StepResponse> = {};
    if (existingSubmission?.step_responses) {
      const stepResponses = existingSubmission.step_responses as any[];
      stepResponses.forEach((resp: any) => {
        responsesMap[resp.step_id] = resp;
      });
    }
    
    if (savedIndex !== undefined && savedIndex >= 0 && savedIndex < steps.length) {
      // Validate all steps before savedIndex are complete
      let firstIncompleteStep = -1;
      for (let i = 0; i < savedIndex; i++) {
        const step = steps[i];
        const resp = responsesMap[step.id];
        
        if (step.required) {
          if (step.type === "checkbox" || step.type === "text") {
            if (!resp || resp.value !== true) {
              firstIncompleteStep = i;
              break;
            }
          } else if (step.type === "file") {
            if (!resp || !resp.file_urls || resp.file_urls.length === 0) {
              firstIncompleteStep = i;
              break;
            }
          }
        }
      }
      
      if (firstIncompleteStep !== -1) {
        // Found an incomplete step before saved index - reset to that step
        console.warn(`Incomplete step ${firstIncompleteStep} found before saved index ${savedIndex}, resetting`);
        setCurrentStepIndex(firstIncompleteStep);
        
        // Update the database with the corrected step index
        if (existingSubmission?.id) {
          await supabase
            .from("task_submissions")
            .update({
              admin_data: {
                ...adminData,
                current_step_index: firstIncompleteStep,
              } as any,
            })
            .eq("id", existingSubmission.id);
        }
      } else {
        setCurrentStepIndex(savedIndex);
      }
    }

    setLoading(false);
  };

  const handleFileUpload = async (stepId: string, file: File) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Bitte melden Sie sich an");
      return;
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Datei ist zu groß. Maximum: 10 MB");
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/zip', 'application/x-zip-compressed'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Ungültiger Dateityp. Erlaubt: JPG, PNG, PDF, ZIP");
      return;
    }

    setUploadingFile(true);

    try {
      // If the user's auth metadata contains a large signature image, the JWT becomes huge and
      // Storage requests can fail with 400 due to header-size limits.
      const metaSig = (session.user as any)?.user_metadata?.signature as string | undefined;
      if (metaSig && metaSig.length > 2000) {
        // best-effort: remove it from auth metadata and refresh token
        await supabase.auth.updateUser({ data: { signature: null } as any });
        await supabase.auth.refreshSession();
      }

      // Upload directly to storage (supports larger files)
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `${session.user.id}/${String(taskId)}/${timestamp}_${sanitizedFileName}`;

      const { error: storageError } = await supabase.storage
        .from("task-files")
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (storageError) {
        throw new Error(storageError.message);
      }

      const { data: uploadRow, error: dbError } = await supabase
        .from("task_file_uploads")
        .insert({
          user_id: session.user.id,
          task_id: String(taskId),
          step_id: stepId,
          file_name: file.name,
          storage_path: storagePath,
          base64_content: "",
          file_size: file.size,
          mime_type: file.type,
        })
        .select("uploaded_at")
        .single();

      if (dbError) {
        // best-effort cleanup
        await supabase.storage.from("task-files").remove([storagePath]);
        throw new Error(dbError.message);
      }

      const uploadedAt = uploadRow?.uploaded_at || new Date().toISOString();

      const existingResponse = responses[stepId];
      const existingFiles = existingResponse?.file_urls || [];

      const newFile = {
        url: `storage://${storagePath}`,
        name: file.name,
        uploaded_at: uploadedAt || new Date().toISOString(),
      };

      const updatedResponses = {
        ...responses,
        [stepId]: {
          step_id: stepId,
          value: `${existingFiles.length + 1} Datei(en)`,
          file_urls: [...existingFiles, newFile],
        },
      };

      setResponses(updatedResponses);
      setUploadingFile(false);
      toast.success("Datei hochgeladen");

      await logActivity('file_upload', currentStepIndex, {
        file_name: file.name,
        file_size: file.size,
      });

      await saveProgressWithResponses(updatedResponses);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Fehler beim Hochladen: ${error.message}`);
      setUploadingFile(false);
    }
  };

  const handleFileDelete = async (stepId: string, fileUrl: string) => {
    const existingResponse = responses[stepId];
    if (!existingResponse?.file_urls) return;

    // Delete from storage if it's a storage file
    if (fileUrl.startsWith('storage://')) {
      const storagePath = fileUrl.replace('storage://', '');
      const { error: deleteError } = await supabase.storage
        .from('task-files')
        .remove([storagePath]);
      
      if (deleteError) {
        console.error("Error deleting from storage:", deleteError);
        // Continue anyway to remove from UI
      }

      // Also delete from task_file_uploads table
      await supabase
        .from('task_file_uploads')
        .delete()
        .eq('storage_path', storagePath);
    }

    const updatedFiles = existingResponse.file_urls.filter(f => f.url !== fileUrl);
    
    const updatedResponses = {
      ...responses,
      [stepId]: {
        step_id: stepId,
        value: updatedFiles.length > 0 ? `${updatedFiles.length} Datei(en)` : '',
        file_urls: updatedFiles,
        file_url: updatedFiles[0]?.url || undefined,
      },
    };

    if (updatedFiles.length === 0) {
      const newResponses = { ...responses };
      delete newResponses[stepId];
      setResponses(newResponses);
      await saveProgressWithResponses(newResponses);
    } else {
      setResponses(updatedResponses);
      await saveProgressWithResponses(updatedResponses);
    }

    toast.success("Datei gelöscht");
  };

  const saveProgressWithResponses = async (responsesToSave: Record<string, StepResponse>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const stepResponsesArray = Object.values(responsesToSave);

    // IMPORTANT: never accidentally overwrite admin_data (e.g. demo credentials)
    // with a partial object. Always merge with the latest DB value.
    const { data: existing } = await supabase
      .from("task_submissions")
      .select("id,status,admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const mergedAdminData = {
      ...((existing as any)?.admin_data || {}),
      ...(persistedAdminData || {}),
      current_step_index: currentStepIndex,
    } as any;

    setPersistedAdminData(mergedAdminData);

    const basePayload: any = {
      task_id: taskId,
      employee_id: session.user.id,
      step_responses: stepResponsesArray,
      checklist_completed: checklistCompleted,
      admin_data: mergedAdminData,
    };

    const payload = existing?.id ? basePayload : { ...basePayload, status: "in_progress" };

    await supabase
      .from("task_submissions")
      .upsert(payload as any, {
        onConflict: "task_id,employee_id"
      });
  };

  const requestKyc = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const stepResponsesArray = Object.values(responses);

    const mergedAdminData = {
      ...(persistedAdminData || {}),
      current_step_index: currentStepIndex,
    } as any;

    const { error } = await supabase
      .from("task_submissions")
      .upsert({
        task_id: taskId,
        employee_id: session.user.id,
        step_responses: stepResponsesArray,
        status: "pending",
        admin_data: mergedAdminData,
      } as any, { onConflict: "task_id,employee_id" });
    if (!error) {
      toast.success("KYC Testdaten angefordert. Bitte warten Sie auf Freigabe durch den Admin.");
      navigate(`/dashboard/tasks/${taskId}/demo-data`);
    } else {
      toast.error("KYC-Anfrage konnte nicht gesendet werden");
    }
  };

  const handleNext = async () => {
    if (!task) return;

    const currentStep = task.steps[currentStepIndex];
    const response = responses[currentStep.id];

    // ============= VALIDATE CURRENT STEP IS COMPLETED =============
    if (currentStep.required) {
      if (currentStep.type === "checkbox" || currentStep.type === "text") {
        if (!response || response.value !== true) {
          toast.error("Bitte bestätigen Sie den Schritt, um fortzufahren");
          return;
        }
      } else if (currentStep.type === "file") {
        if (!response || !response.file_urls || response.file_urls.length === 0) {
          toast.error("Bitte laden Sie die erforderlichen Dokumente hoch");
          return;
        }
      } else if (!response) {
        toast.error("Bitte füllen Sie dieses Pflichtfeld aus");
        return;
      }
    }

    // ============= VALIDATE ALL PREVIOUS STEPS ARE COMPLETED =============
    for (let i = 0; i < currentStepIndex; i++) {
      const prevStep = task.steps[i];
      const prevResponse = responses[prevStep.id];
      
      if (prevStep.required) {
        if (prevStep.type === "checkbox" || prevStep.type === "text") {
          if (!prevResponse || prevResponse.value !== true) {
            toast.error(`Bitte schließen Sie zuerst Schritt ${i + 1} ab: ${prevStep.title}`);
            setCurrentStepIndex(i);
            return;
          }
        } else if (prevStep.type === "file") {
          if (!prevResponse || !prevResponse.file_urls || prevResponse.file_urls.length === 0) {
            toast.error(`Bitte schließen Sie zuerst Schritt ${i + 1} ab: ${prevStep.title}`);
            setCurrentStepIndex(i);
            return;
          }
        }
      }
    }

    // ============= CHECK IF THIS IS THE LAST STEP BEFORE A MODULE TRANSITION =============
    const nextStepIndex = currentStepIndex + 1;
    const isLastStepOfType = nextStepIndex >= task.steps.length || task.steps[nextStepIndex].type !== currentStep.type;
    
    // If this is the last checkbox step and there are more steps, check if we need to request KYC
    if (currentStep.type === "checkbox" && isLastStepOfType && nextStepIndex < task.steps.length) {
      // Check if ALL relevant checkbox steps are completed
      // When restart_from_step is set, only validate from that step onward
      const restartStepId = (persistedAdminData as any)?.restart_from_step as string | undefined;
      const restartIndex = restartStepId ? task.steps.findIndex(s => s.id === restartStepId) : -1;

      const allCheckboxSteps = task.steps.filter(s => s.type === "checkbox");
      const scopedCheckboxSteps = restartIndex >= 0
        ? allCheckboxSteps.filter(s => task.steps.findIndex(ts => ts.id === s.id) >= restartIndex)
        : allCheckboxSteps;

      const allCheckboxCompleted = scopedCheckboxSteps.every(s => {
        const r = responses[s.id];
        return r && r.value === true;
      });
      
      if (allCheckboxCompleted) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const stepResponsesArray = Object.values(responses);
        
        const { error } = await supabase
          .from("task_submissions")
          .upsert({
            task_id: taskId,
            employee_id: session.user.id,
            step_responses: stepResponsesArray,
            status: "pending",
            admin_data: {
              ...(persistedAdminData || {}),
              current_step_index: nextStepIndex,
              demo_data_requested_at: new Date().toISOString(),
            } as any,
          } as any, { onConflict: "task_id,employee_id" });
        
        if (error) {
          console.error("Error requesting demo data:", error);
          toast.error("Fehler beim Anfordern der Demo-Daten");
          return;
        }
        
        toast.success("Demo-Daten wurden erfolgreich angefordert!");
        navigate(`/dashboard/tasks/${taskId}/demo-data`);
        return;
      }
    }

    // Move to next step and save with new index
    if (nextStepIndex < task.steps.length) {
      setCurrentStepIndex(nextStepIndex);
      await saveProgressWithIndex(nextStepIndex);
    }
  };

  const saveProgress = async () => {
    await saveProgressWithIndex(currentStepIndex);
  };

  const saveProgressWithIndex = async (stepIndex: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const stepResponsesArray = Object.values(responses);

    const { data: existing } = await supabase
      .from("task_submissions")
      .select("id,status,admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const mergedAdminData = {
      ...((existing as any)?.admin_data || {}),
      ...(persistedAdminData || {}),
      current_step_index: stepIndex,
    } as any;

    setPersistedAdminData(mergedAdminData);

    const basePayload: any = {
      task_id: taskId,
      employee_id: session.user.id,
      step_responses: stepResponsesArray,
      checklist_completed: checklistCompleted,
      admin_data: mergedAdminData,
    };

    const payload = existing?.id ? basePayload : { ...basePayload, status: "in_progress" };

    await supabase
      .from("task_submissions")
      .upsert(payload as any, {
        onConflict: "task_id,employee_id"
      });
  };

  const handlePrevious = () => {
    // Nur erlauben, wenn der vorherige Schritt NICHT bereits abgeschlossen ist
    // Oder wenn wir zu einem vorherigen Schritt gehen, der noch nicht bestätigt wurde
    if (currentStepIndex > 0) {
      const prevStepIndex = currentStepIndex - 1;
      const prevStep = task?.steps[prevStepIndex];
      const prevResponse = responses[prevStep?.id || ''];
      
      // Wenn der vorherige Schritt bereits bestätigt wurde, kann der User nicht zurück
      if (prevStep?.required && prevResponse?.value === true) {
        toast.error("Dieser Schritt wurde bereits bestätigt und kann nicht mehr bearbeitet werden");
        return;
      }
      
      setCurrentStepIndex(prevStepIndex);
    }
  };

  const handleSubmit = async (validateAll: boolean = true) => {
    if (!task) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: existingSubmission } = await supabase
      .from("task_submissions")
      .select("status, admin_data")
      .eq("task_id", taskId)
      .eq("employee_id", session.user.id)
      .maybeSingle();

    const effectiveAdminData = {
      ...((existingSubmission as any)?.admin_data || {}),
      ...(persistedAdminData || {}),
    } as any;

    // ============= MODULE DETECTION =============
    const kycModule = hasKycModule(task.steps);
    const uploadModule = hasUploadModule(task.steps);
    const onlyText = hasOnlyTextSteps(task.steps);

    const currentStep = task.steps[currentStepIndex];
    const postalCompletedFlag = !!((persistedAdminData as any)?.postal_documents_completed || (persistedAdminData as any)?.postal_documents_completed_at);
    const kycStepCompleted = existingSubmission?.status === "kyc_completed" || !!effectiveAdminData?.kyc_completed;
    const isUploadPhase = uploadModule && (currentStep.type === "file" || postalCompletedFlag || kycStepCompleted);

    // ============= VALIDATION =============
    if (validateAll) {
      // Finde den ersten Nicht-Text-Schritt (KYC/Upload)
      const firstNonTextStepIndex = task.steps.findIndex(s => s.type !== "text");
      const isStillInTextSteps = firstNonTextStepIndex === -1 || currentStepIndex < firstNonTextStepIndex;
      
      let stepsToValidate;
      if (isUploadPhase) {
        // In Upload-Phase: nur Upload-Schritte validieren
        stepsToValidate = task.steps.filter(step => step.type === "file" && step.required);
      } else if (isStillInTextSteps) {
        // Noch bei Text-Schritten: nur Text-Schritte validieren
        stepsToValidate = task.steps.filter(step => 
          step.type === "text" && step.required && task.steps.indexOf(step) <= currentStepIndex
        );
      } else {
        // Bei KYC/anderen Modulen: alle Schritte bis zum aktuellen validieren, aber keine zukünftigen Upload-Schritte
        stepsToValidate = task.steps.filter((step, idx) => 
          step.required && idx <= currentStepIndex
        );
      }

      // Wenn restart_from_step gesetzt ist, nur ab diesem Schritt validieren
      const restartStepId = (persistedAdminData as any)?.restart_from_step;
      if (restartStepId) {
        const restartIndex = task.steps.findIndex(s => s.id === restartStepId);
        if (restartIndex !== -1) {
          stepsToValidate = stepsToValidate.filter(step => {
            const stepIndex = task.steps.findIndex(s => s.id === step.id);
            return stepIndex >= restartIndex;
          });
        }
      }

      for (const step of stepsToValidate) {
        const response = responses[step.id];
        
        if (step.type === "file") {
          if (!response || !response.file_urls || response.file_urls.length === 0) {
            toast.error(`Bitte laden Sie alle erforderlichen Dokumente hoch: ${step.title}`);
            return;
          }
        } else if (step.type === "checkbox") {
          if (!response || response.value !== true) {
            toast.error(`Bitte füllen Sie aus: ${step.title}`);
            return;
          }
        } else if (step.type === "text") {
          if (!response || response.value !== true) {
            toast.error(`Bitte bestätigen Sie: ${step.title}`);
            return;
          }
        } else if (!response) {
          toast.error(`Bitte füllen Sie alle Pflichtfelder aus`);
          return;
        }
      }
    } else {
      const step = task.steps[currentStepIndex];
      const response = responses[step.id];
      if (step.required && !response) {
        toast.error("Bitte füllen Sie dieses Pflichtfeld aus");
        return;
      }
      if ((step.type === "checkbox") && step.required && response?.value !== true) {
        toast.error("Bitte bestätigen Sie, um fortzufahren");
        return;
      }
      if ((step.type === "text") && step.required && response?.value !== true) {
        toast.error("Bitte bestätigen Sie, um fortzufahren");
        return;
      }
    }

    setSubmitting(true);

    const stepResponsesArray = Object.values(responses);
    
    // ============= DETERMINE STATUS & NAVIGATION =============
    let newStatus: string;
    let redirectPath: string;
    let successMessage: string;

    // ============= PRIORITY 1: Demo-Daten anfordern (nur während der KYC-Checkbox-Phase) =============
    const needsDemoData = kycModule && currentStep.type === "checkbox" && !effectiveAdminData?.email;
    
    if (needsDemoData) {
      // Wenn Demo-Daten noch nicht vorhanden sind, immer zuerst Demo-Daten anfordern
      newStatus = "pending";
      redirectPath = `/dashboard/tasks/${taskId}/demo-data`;
      successMessage = "Demo-Daten wurden angefragt. Bitte warten Sie auf die Bereitstellung vom Admin.";
    } else if (isUploadPhase) {
      // Nach abgeschlossenem KYC: Wenn Upload-Modul vorhanden, erst Postal-Protokoll abschließen
      const postalCompleted = uploadModule
        ? !!((persistedAdminData as any)?.postal_documents_completed || (persistedAdminData as any)?.postal_documents_completed_at)
        : true;

      if (uploadModule && !postalCompleted) {
        newStatus = "in_progress";
        redirectPath = `/dashboard/tasks/${taskId}/postal-documents-check`;
        successMessage = "Bitte füllen Sie zuerst das Postalische Unterlagen-Protokoll aus";
      } else {
        // Uploadphase abgeschlossen -> Bestätigungsseite und Status zur Prüfung
        newStatus = "awaiting_review";
        redirectPath = `/dashboard/tasks/${taskId}/submitted`;
        successMessage = "Uploads erfolgreich eingereicht. Der Auftrag wurde zur Prüfung übermittelt.";
      }
    } else if (kycModule && !uploadModule) {
      // Nur KYC-Modul ohne Upload -> direkt zur Qualitätsprüfung
      newStatus = "in_progress";
      redirectPath = `/dashboard/tasks/${taskId}/quality-check`;
      successMessage = "Bitte füllen Sie nun das Bewertungsprotokoll aus";
    } else if (uploadModule && !kycModule) {
      // Upload-Modul ohne KYC
      const postalCompleted = !!((persistedAdminData as any)?.postal_documents_completed || (persistedAdminData as any)?.postal_documents_completed_at);
      if (postalCompleted) {
        // Alle erforderlichen Uploads + Protokoll erledigt -> zur Prüfung einreichen
        newStatus = "awaiting_review";
        redirectPath = `/dashboard/tasks/${taskId}/submitted`;
        successMessage = "Uploads erfolgreich eingereicht. Der Auftrag wurde zur Prüfung übermittelt.";
      } else {
        // Erst das postalische Protokoll ausfüllen
        newStatus = "in_progress";
        redirectPath = `/dashboard/tasks/${taskId}/postal-documents-check`;
        successMessage = "Bitte füllen Sie zuerst das Postalische Unterlagen-Protokoll aus";
      }
    } else if (onlyText) {
      // Nur Text-Schritte -> direkt zur Qualitätsprüfung
      newStatus = "in_progress";
      redirectPath = `/dashboard/tasks/${taskId}/quality-check`;
      successMessage = "Bitte füllen Sie nun das Bewertungsprotokoll aus";
    } else {
      // Default fallback
      newStatus = "in_progress";
      redirectPath = `/dashboard/tasks`;
      successMessage = "Auftrag gespeichert";
    }

    const { error } = await supabase
      .from("task_submissions")
      .upsert({
        task_id: taskId,
        employee_id: session.user.id,
        step_responses: stepResponsesArray,
        status: newStatus,
        admin_data: {
          ...effectiveAdminData,
          current_step_index: currentStepIndex,
          restart_from_step: null, // Entfernen nach erfolgreichem Submit
        } as any,
      } as any, {
        onConflict: "task_id,employee_id"
      });

    if (error) {
      console.error("Submission error:", error);
      toast.error("Fehler beim Absenden");
      setSubmitting(false);
      return;
    }

    // Log submission activity
    await logActivity('submission', currentStepIndex, { 
      status: newStatus 
    });

    toast.success(successMessage);
    navigate(redirectPath);
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Auftrag nicht gefunden
            </CardTitle>
            <CardDescription>
              Der angeforderte Auftrag konnte nicht geladen werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard/tasks")} className="w-full">
              Zurück zur Übersicht
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!Array.isArray(task.steps) || task.steps.length === 0) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard/tasks")}>← Zurück</Button>
        <Card className="mt-6"><CardContent className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">{task.title}</h2>
          <p className="text-muted-foreground mb-6">Für diesen Auftrag gibt es keine Einleitungsschritte. Du kannst direkt mit den Demo-Daten fortfahren.</p>
          <Button onClick={() => navigate(`/dashboard/tasks/${taskId}/demo-data`)}>Weiter zu den Demo-Daten</Button>
        </CardContent></Card>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(currentStepIndex, 0), task.steps.length - 1);
  const currentStep = task.steps[safeIndex];
  const progress = ((safeIndex + 1) / task.steps.length) * 100;
  const isLastStep = safeIndex === task.steps.length - 1;
  const isFirstStep = safeIndex === 0;
  const currentResponse = responses[currentStep.id];

  // Check if task is under review
  const isUnderReview = submissionStatus === "awaiting_review" || submissionStatus === "in_review";

  // Determine if current step is part of upload module and needs checklist
  const isUploadStep = currentStep.type === "file";
  const needsChecklist = isUploadStep && !checklistCompleted && showChecklist;

  // ============= MODULE INDICATORS =============
  const kycModuleActive = hasKycModule(task.steps);
  const uploadModuleActive = hasUploadModule(task.steps);
  const isKycConsentStep = currentStepIndex === 0 && currentStep.type === "checkbox";
  
  // Check if task needs demo data (KYC flow) and hasn't been provided yet
  // Only relevant while the user is on the KYC consent (checkbox) step.
  const needsDemoData = kycModuleActive && currentStep.type === "checkbox" && !persistedAdminData?.email;

  const isStepCompleted = (stepId: string) => {
    const response = responses[stepId];
    const step = task.steps.find(s => s.id === stepId);
    if (!response) return false;
    if (step?.type === "file") return response.file_urls && response.file_urls.length > 0;
    if (step?.type === "checkbox" || step?.type === "text") return response.value === true;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Card – Redesign with banner, time & comp range */}
        {(() => {
          // ===== Time calculations =====
          const estimatedHours = task.estimated_hours ?? null;
          const demoProvidedAt =
            (persistedAdminData as any)?.demo_data_provided_at ||
            (persistedAdminData as any)?.demo_data_requested_at ||
            null;
          const deadlineDays = task.deadline_days ?? 7;
          let remainingLabel: string | null = null;
          if (demoProvidedAt) {
            const start = new Date(demoProvidedAt).getTime();
            const end = start + deadlineDays * 24 * 60 * 60 * 1000;
            const diffMs = end - Date.now();
            if (diffMs > 0) {
              const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
              const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
              remainingLabel = days > 0 ? `${days}T ${hours}h` : `${hours}h`;
            } else {
              remainingLabel = "Abgelaufen";
            }
          }

          // ===== Compensation calculations =====
          const base = Number(task.compensation_amount ?? 0);
          let maxBonus = 0;
          const bonusBreakdown: { label: string; amount: number }[] = [];
          for (const step of task.steps ?? []) {
            if (step.ask_postal_consent && step.postal_consent_bonus) {
              const b = Number(step.postal_consent_bonus);
              if (b > 0) {
                maxBonus += b;
                bonusBreakdown.push({ label: "Postalische Zusendung", amount: b });
              }
            }
            if (step.ask_id_document && step.id_document_bonus) {
              const vals = Object.values(step.id_document_bonus).map((v) => Number(v ?? 0));
              const maxIdBonus = vals.length ? Math.max(...vals) : 0;
              if (maxIdBonus > 0) {
                maxBonus += maxIdBonus;
                bonusBreakdown.push({ label: "Ausweisdokument-Bonus", amount: maxIdBonus });
              }
            }
          }
          const total = base + maxBonus;
          const fmt = (n: number) =>
            n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

          return (
            <Card className="relative overflow-hidden border-none shadow-2xl">
              {/* Banner background */}
              <div className="absolute inset-0">
                {bannerUrls.length > 0 ? (
                  <TaskImageRotator
                    urls={bannerUrls}
                    alt={task.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/30 via-primary/15 to-background" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/95 to-background/80" />
                <div className="absolute inset-0 backdrop-blur-md" />
              </div>

              <div className="relative">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {task.logo_url && (
                        <div className="h-14 w-14 rounded-xl bg-background/90 backdrop-blur shadow-lg ring-1 ring-border/50 flex items-center justify-center overflow-hidden">
                          <img src={task.logo_url} alt="" className="h-10 w-10 object-contain" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-2xl md:text-3xl font-bold tracking-tight">
                            {task.title}
                          </CardTitle>
                        </div>
                        {task.description && (
                          <CardDescription className="text-sm md:text-base mt-1 max-w-2xl">
                            {task.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/tasks")}>
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Stat tiles */}
                <CardContent className="pt-0 pb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Estimated time */}
                    <div className="rounded-xl bg-background/80 backdrop-blur border border-border/60 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        <Clock className="h-3.5 w-3.5" />
                        Geschätzte Dauer
                      </div>
                      <div className="text-xl font-semibold">
                        {estimatedHours ? `ca. ${estimatedHours} h` : "—"}
                      </div>
                    </div>

                    {/* Remaining time after demo data */}
                    <div className="rounded-xl bg-background/80 backdrop-blur border border-border/60 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mb-1">
                        <Timer className="h-3.5 w-3.5" />
                        Verbleibende Zeit
                      </div>
                      <div className={`text-xl font-semibold ${remainingLabel === "Abgelaufen" ? "text-destructive" : ""}`}>
                        {remainingLabel ?? <span className="text-muted-foreground text-sm font-normal">—</span>}
                      </div>
                      {remainingLabel && remainingLabel !== "Abgelaufen" && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          ab Eingang der Demo-Daten · {deadlineDays} Tage
                        </div>
                      )}
                    </div>

                    {/* Compensation range */}
                    {(base > 0 || maxBonus > 0) && (
                      <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 backdrop-blur border border-emerald-400/40 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                          <Euro className="h-3.5 w-3.5" />
                          Vergütung
                        </div>
                        <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
                          {maxBonus > 0 ? (
                            <>
                              {fmt(base)} € <span className="text-muted-foreground font-normal">–</span> {fmt(total)} €
                            </>
                          ) : (
                            <>{fmt(base)} €</>
                          )}
                        </div>
                        {maxBonus > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Grundbetrag {fmt(base)} €
                            </div>
                            {bonusBreakdown.map((b, i) => (
                              <div key={i} className="text-[11px] text-muted-foreground pl-4">
                                + {b.label}: bis {fmt(b.amount)} €
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {task.due_date && demoProvidedAt && (
                    <div className="mt-4">
                      <DeadlineBadge dueDate={task.due_date} large />
                    </div>
                  )}
                </CardContent>
              </div>
            </Card>
          );
        })()}

        {/* Demo-Daten Anzeige für Mitarbeiter - ID Badge Style */}
        {/* Nur anzeigen wenn echte Demo-Credentials vorhanden sind (username, password, passcode, ident_link), nicht nur generierte E-Mails */}
        {persistedAdminData && persistedAdminData.demo_data && (persistedAdminData.username || persistedAdminData.password || persistedAdminData.passcode || persistedAdminData.ident_link) && (
          <CredentialsBadge 
            data={{
              email: persistedAdminData.email,
              username: persistedAdminData.username,
              password: persistedAdminData.password,
              passcode: persistedAdminData.passcode,
              ident_link: persistedAdminData.ident_link,
              info: persistedAdminData.info,
              image_url: persistedAdminData.image_url,
            }}
            taskId={taskId}
          />
        )}

        {/* Rejection Notice - wird angezeigt wenn notes vorhanden sind */}
        {rejectionNotes && (
          <Card className="border-destructive bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Korrektur erforderlich
              </CardTitle>
              <CardDescription className="text-destructive/80">
                <span className="font-medium">Grund:</span> {rejectionNotes}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Auftrags-Aktionen: Komplett beenden / Fortschritt zurücksetzen */}
        {!isUnderReview && taskId && (
          <TaskActionsBar taskId={taskId} />
        )}

        {/* Progress Bar */}
        <Card>

          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Fortschritt</span>
                <span className="text-muted-foreground">{currentStepIndex + 1} von {task.steps.length} Schritten</span>
              </div>
              <Progress value={progress} className="h-2" />
              
              {/* Step indicators */}
              <div className="flex justify-between mt-4 gap-2">
                {task.steps.map((step, index) => {
                  const completed = isStepCompleted(step.id);
                  const isCurrent = index === currentStepIndex;
                  
                  return (
                    <div 
                      key={step.id} 
                      className={`flex-1 h-2 rounded-full transition-all ${
                        completed 
                          ? 'bg-primary' 
                          : isCurrent 
                            ? 'bg-primary/50' 
                            : 'bg-muted'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Checklist Modal */}
        {needsChecklist && (
          <BankingChecklist 
            onComplete={() => {
              setChecklistCompleted(true);
              setShowChecklist(false);
            }}
          />
        )}

        {/* Main Step Card */}
        {!needsChecklist && (
          <Card className="border-none shadow-xl overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.id}
                variants={stepVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={stepTransition}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{currentStep.title}</CardTitle>
                      {currentStep.description && (
                        <CardDescription className="text-base whitespace-pre-wrap">
                          {currentStep.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>

            <CardContent className="space-y-6">
              {/* Text Input */}
              {currentStep.type === "text" && (
                <div className="space-y-4">
                  {currentStep.ask_postal_consent && (
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Sind Sie bereit, postalische Zusendungen vom Auftraggeber zusätzlich zu bearbeiten?
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bitte wählen Sie eine Option, bevor Sie fortfahren.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          { value: "yes", label: "Ja, ich bearbeite postalische Zusendungen" },
                          { value: "no", label: "Nein" },
                        ] as const).map((opt) => {
                          const selected = currentResponse?.postal_consent === opt.value;
                          const bonus = currentStep.postal_consent_bonus ?? 0;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isUnderReview}
                              onClick={() => {
                                const next: StepResponse = {
                                  ...(currentResponse || { step_id: currentStep.id, value: false }),
                                  step_id: currentStep.id,
                                  postal_consent: opt.value,
                                };
                                setResponses({ ...responses, [currentStep.id]: next });
                              }}
                              className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 text-center ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                                  : "border-border bg-background hover:bg-muted"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {opt.value === "yes" && bonus > 0 && (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  + {bonus.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Bonus
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <input
                      type="checkbox"
                      id="text-ack"
                      checked={currentResponse?.value === true}
                      onChange={(e) => {
                        if (currentStep.ask_postal_consent && !currentResponse?.postal_consent) {
                          toast.error("Bitte wählen Sie zuerst eine Option zur postalischen Zusendung aus.");
                          return;
                        }
                        setResponses({
                          ...responses,
                          [currentStep.id]: {
                            ...(currentResponse || { step_id: currentStep.id }),
                            step_id: currentStep.id,
                            value: e.target.checked,
                          },
                        });
                      }}
                      disabled={isUnderReview}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="text-ack" className="cursor-pointer flex-1">
                      Ich habe die Informationen gelesen und verstanden
                    </Label>
                  </div>
                </div>
              )}

              {/* Checkbox Input */}
              {currentStep.type === "checkbox" && (
                <div className="space-y-4">
                  {currentStep.ask_id_document && (
                    <div className="p-4 rounded-lg border bg-card space-y-3">
                      <div>
                        <Label className="text-sm font-medium">
                          Mit welchem Ausweisdokument möchten Sie die Identifizierung ausführen?
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Bitte wählen Sie ein Dokument aus, bevor Sie fortfahren.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { value: "personalausweis", label: "Deutscher Personalausweis" },
                          { value: "reisepass", label: "Reisepass" },
                        ]
                          .filter((opt) => {
                            const allowed = currentStep.id_document_options ?? ["personalausweis", "reisepass"];
                            return allowed.includes(opt.value as any);
                          })
                          .map((opt) => {
                          const selected = currentResponse?.id_document === opt.value;
                          const bonus = currentStep.id_document_bonus?.[opt.value as "personalausweis" | "reisepass"] ?? 0;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isUnderReview}
                              onClick={() => {
                                const next: StepResponse = {
                                  ...(currentResponse || { step_id: currentStep.id, value: false }),
                                  step_id: currentStep.id,
                                  id_document: opt.value,
                                };
                                setResponses({ ...responses, [currentStep.id]: next });
                              }}
                              className={`p-3 rounded-lg border text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/30"
                                  : "border-border bg-background hover:bg-muted"
                              }`}
                            >
                              <span>{opt.label}</span>
                              {bonus > 0 && (
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  + {bonus.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € Bonus
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
                    <input
                      type="checkbox"
                      id="checkbox-response"
                      checked={currentResponse?.value === true}
                      onChange={(e) => {
                        if (currentStep.ask_id_document && !currentResponse?.id_document) {
                          toast.error("Bitte wählen Sie zuerst ein Ausweisdokument aus.");
                          return;
                        }
                        setResponses({
                          ...responses,
                          [currentStep.id]: {
                            ...(currentResponse || { step_id: currentStep.id }),
                            step_id: currentStep.id,
                            value: e.target.checked,
                          },
                        });
                      }}
                      disabled={isUnderReview}
                      className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="checkbox-response" className="cursor-pointer flex-1">
                      Ich stimme zu und fordere die Demo Daten an
                    </Label>
                  </div>
                  
                </div>
              )}

              {/* File Upload */}
              {currentStep.type === "file" && (
                <div className="space-y-4">
                  {/* Animated Upload Header */}
                  <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10">
                    <CardContent className="pt-6 pb-6">
                      {/* Floating animated icons */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div className="absolute right-[5%] top-[10%] text-primary/20"
                          animate={{ y: [0, -8, 0], rotate: [-10, -5, -10] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                          <Camera className="h-14 w-14" strokeWidth={1.2} />
                        </motion.div>
                        <motion.div className="absolute right-[20%] bottom-[8%] text-primary/15"
                          animate={{ y: [0, -6, 0], rotate: [5, 10, 5] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}>
                          <FileText className="h-12 w-12" strokeWidth={1.2} />
                        </motion.div>
                        <motion.div className="absolute left-[3%] bottom-[15%] text-destructive/15"
                          animate={{ y: [0, -5, 0], rotate: [0, -8, 0] }}
                          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}>
                          <Mail className="h-12 w-12" strokeWidth={1.2} />
                        </motion.div>
                        <motion.div className="absolute left-[15%] top-[8%] text-primary/10"
                          animate={{ y: [0, -10, 0], scale: [0.95, 1.05, 0.95] }}
                          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}>
                          <Search className="h-16 w-16" strokeWidth={1} />
                        </motion.div>
                      </div>

                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                          <motion.div
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
                            <Upload className="h-5 w-5 text-primary" />
                          </motion.div>
                          <p className="text-sm font-semibold text-foreground">Wichtige Hinweise zum Dokument-Upload</p>
                        </div>

                        <div>
                          <p className="text-sm text-foreground font-medium">Was hochgeladen wird:</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            In diesem Schritt laden Sie die erforderlichen Dokumente hoch, die Sie postalisch vom Auftraggeber (z. B. der Bank) erhalten haben.
                          </p>
                        </div>

                        {/* Confidentiality & Destruction Warning – redesigned */}
                        <motion.div
                          className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4, delay: 0.2 }}>
                          <div className="flex items-center gap-2 mb-3">
                            <motion.div
                              animate={{ rotate: [0, -10, 10, 0] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                              <ShieldAlert className="h-5 w-5 text-destructive" />
                            </motion.div>
                            <p className="text-sm font-semibold text-destructive">Geheimhaltung & Vernichtung</p>
                          </div>
                          <ul className="space-y-3 text-sm text-destructive/80">
                            <li className="flex gap-3 items-start">
                              <motion.div className="flex-shrink-0 mt-0.5"
                                animate={{ scale: [1, 1.15, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                                <Scissors className="h-5 w-5 text-destructive/70" />
                              </motion.div>
                              <span>Nach dem Upload <strong>vernichten Sie alle postalischen Dokumente</strong> (Briefe, Unterlagen) unverzüglich durch Schreddern oder Zerreißen.</span>
                            </li>
                            <li className="flex gap-3 items-start">
                              <motion.div className="flex-shrink-0 mt-0.5"
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}>
                                <CreditCard className="h-5 w-5 text-destructive/70" />
                              </motion.div>
                              <span>Sollten Sie <strong>Karten</strong> (z. B. Bankkarten) miterhalten haben, <strong>zerschreddern Sie diese ebenfalls</strong>. Diese Karten sind wertlos und dienen Ihnen lediglich als Trophäe für Ihre digitale Bibliothek.</span>
                            </li>
                            <li className="flex gap-3 items-start">
                              <motion.div className="flex-shrink-0 mt-0.5"
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}>
                                <BookOpen className="h-5 w-5 text-destructive/70" />
                              </motion.div>
                              <span>Alle hochgeladenen Dokumente können Sie jederzeit in Ihrer <strong>Bibliothek</strong> einsehen.</span>
                            </li>
                          </ul>
                        </motion.div>
                        
                        {/* Tips section – redesigned */}
                        <div>
                          <p className="text-sm text-foreground font-medium mb-2">Worauf Sie achten sollten:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                              { icon: Eye, label: "Lesbarkeit", text: "Alle Dokumente müssen klar und vollständig erkennbar sein" },
                              { icon: Sun, label: "Beleuchtung", text: "Bei Fotos auf ausreichende Helligkeit ohne Schatten achten" },
                              { icon: FileCheck, label: "Vollständigkeit", text: "Name, Geburtsdatum, Dokumentnummer müssen sichtbar sein" },
                              { icon: Camera, label: "Dateiformat", text: "Nur PDF, JPG, PNG verwenden" },
                              { icon: HardDrive, label: "Dateigröße", text: "Max. 10 MB pro Datei" },
                            ].map(({ icon: TipIcon, label, text }, i) => (
                              <motion.div
                                key={label}
                                className="flex items-start gap-2 rounded-lg bg-muted/50 p-2.5"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + i * 0.08 }}>
                                <TipIcon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-xs font-semibold text-foreground">{label}: </span>
                                  <span className="text-xs text-muted-foreground">{text}</span>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {!isUnderReview && (
                    <motion.div
                      className="relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 group overflow-hidden"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                        e.currentTarget.classList.remove('border-muted-foreground/25');
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                        e.currentTarget.classList.add('border-muted-foreground/25');
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                        e.currentTarget.classList.add('border-muted-foreground/25');
                        const files = e.dataTransfer.files;
                        if (files && files.length > 0) {
                          for (let i = 0; i < files.length; i++) {
                            await handleFileUpload(currentStep.id, files[i]);
                          }
                        }
                      }}
                      style={{ borderColor: uploadingFile ? 'hsl(var(--primary))' : undefined }}
                    >
                      {/* Animated background circles */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <motion.div
                          className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-primary/5"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        />
                        <motion.div
                          className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-accent/10"
                          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
                          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>

                      <input
                        type="file"
                        id="file-upload"
                        multiple
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            for (let i = 0; i < files.length; i++) {
                              await handleFileUpload(currentStep.id, files[i]);
                            }
                            e.target.value = '';
                          }
                        }}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer relative z-10 block">
                        <motion.div
                          className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"
                          animate={uploadingFile
                            ? { scale: [1, 1.1, 1], rotate: [0, 0, 0] }
                            : { y: [0, -6, 0] }
                          }
                          transition={{ duration: uploadingFile ? 1 : 2.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {uploadingFile ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            >
                              <Loader2 className="h-8 w-8 text-primary" />
                            </motion.div>
                          ) : (
                            <Upload className="h-8 w-8 text-primary" />
                          )}
                        </motion.div>

                        <p className="text-base font-semibold text-foreground mb-1">
                          {uploadingFile ? "Wird hochgeladen..." : "Dateien hochladen"}
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Klicken oder Dateien hierher ziehen
                        </p>

                        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground/70">
                          {[
                            { icon: Camera, label: "JPG / PNG" },
                            { icon: FileText, label: "PDF" },
                            { icon: FolderOpen, label: "ZIP" },
                          ].map(({ icon: Icon, label }, i) => (
                            <motion.div
                              key={label}
                              className="flex items-center gap-1"
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.4 + i * 0.1 }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{label}</span>
                            </motion.div>
                          ))}
                        </div>
                      </label>
                    </motion.div>
                  )}

                  {/* Uploaded Files List */}
                  {currentResponse?.file_urls && currentResponse.file_urls.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Hochgeladene Dateien:</Label>
                      <div className="space-y-2">
                        {currentResponse.file_urls.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm truncate">{file.name}</span>
                            </div>
                            {!isUnderReview && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleFileDelete(currentStep.id, file.url)}
                                className="ml-2 flex-shrink-0"
                              >
                                Löschen
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                {(() => {
                  // Check if this is the last checkbox step before upload module
                  const nextStepIndex = currentStepIndex + 1;
                  const isLastCheckboxStep = currentStep.type === "checkbox" && 
                    (nextStepIndex >= task.steps.length || task.steps[nextStepIndex].type !== "checkbox");
                  const shouldRequestDemoData = needsDemoData && isLastCheckboxStep && kycModuleActive;

                  if (shouldRequestDemoData) {
                    return (
                      <Button
                        onClick={() => handleSubmit(true)}
                        disabled={submitting || isUnderReview || (currentStep.required && !currentResponse)}
                        className="w-full"
                      >
                        Demo-Daten anfordern
                      </Button>
                    );
                  } else if (!isLastStep) {
                    return (
                      <Button
                        onClick={handleNext}
                        disabled={submitting || isUnderReview || (currentStep.required && !currentResponse)}
                        className="w-full"
                      >
                        Weiter
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    );
                  } else {
                    return (
                      <Button
                        onClick={() => handleSubmit(true)}
                        disabled={submitting || isUnderReview}
                        className="w-full"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Einreichen
                      </Button>
                    );
                  }
                })()}
              </div>
            </CardContent>
              </motion.div>
            </AnimatePresence>
          </Card>
        )}

        {/* Under Review Notice */}
        {isUnderReview && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Auftrag wird geprüft
              </CardTitle>
              <CardDescription>
                Ihre Einreichung wird derzeit überprüft. Eine Bearbeitung ist nicht mehr möglich. Sie werden benachrichtigt, sobald die Prüfung abgeschlossen ist.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TaskDetail;
