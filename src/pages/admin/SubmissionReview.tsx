import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, CheckCircle2, XCircle, FileText, Download, Eye } from "lucide-react";
import { toast } from "@/lib/toast-stub";

interface Submission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  step_responses: any;
  checklist_data: any;
  checklist_completed: boolean;
  created_at: string;
  submitted_at: string;
  notes?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  admin_data?: any;
}

interface Task {
  id: string;
  title: string;
  description: string;
  steps: any;
}

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
}

import { FileUpload, getFileUrl } from "@/lib/fileUploadUtils";

const SubmissionReview = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [employee, setEmployee] = useState<Profile | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedStep, setSelectedStep] = useState<string>("");
  const [fileUploads, setFileUploads] = useState<Record<string, FileUpload[]>>({});
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchData();
  }, [submissionId]);

  const checkAuthAndFetchData = async () => {
    console.log("=== ADMIN REVIEW: CHECK AUTH AND FETCH DATA ===");
    console.log("Submission ID:", submissionId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("No session, redirecting to auth");
      navigate("/auth");
      return;
    }
    console.log("Session user ID:", session.user.id);

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    console.log("User roles:", roles);

    if (!roles || roles.role !== "admin") {
      console.log("User is not admin, redirecting");
      toast.error("Keine Berechtigung");
      navigate("/dashboard");
      return;
    }
    console.log("✓ User is admin");

    // Fetch submission
    console.log("Fetching submission data...");
    const { data: submissionData, error: submissionError } = await supabase
      .from("task_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    console.log("Submission data:", {
      found: !!submissionData,
      error: submissionError,
      data: submissionData
    });

    if (submissionError || !submissionData) {
      console.error("❌ Error fetching submission:", submissionError);
      toast.error("Submission nicht gefunden");
      navigate("/admin/tasks");
      return;
    }
    console.log("✓ Submission loaded");

    setSubmission(submissionData as any);

    // Fetch task
    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", submissionData.task_id)
      .single();

    if (taskData) {
      setTask(taskData as any);
      // Set first step as default selected step for rejection
      const steps = (taskData.steps as any[]) || [];
      if (steps.length > 0) {
        setSelectedStep(steps[0].id);
      }
    }

    // Fetch employee profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", submissionData.employee_id)
      .single();

    if (profileData) {
      setEmployee(profileData);
    }

    // Fetch file uploads from task_file_uploads
    console.log("=== ADMIN REVIEW: FETCHING FILE UPLOADS ===");
    console.log("Task ID:", submissionData.task_id);
    console.log("Employee ID:", submissionData.employee_id);
    
    const { data: fileUploadsData, error: fileError } = await supabase
      .from("task_file_uploads")
      .select("*")
      .eq("task_id", submissionData.task_id)
      .eq("user_id", submissionData.employee_id)
      .order("uploaded_at", { ascending: false });

    console.log("File uploads query result:", {
      count: fileUploadsData?.length || 0,
      error: fileError,
      data: fileUploadsData
    });

    if (fileError) {
      console.error("❌ Error fetching file uploads:", fileError);
    } else if (fileUploadsData) {
      console.log("✓ Successfully fetched", fileUploadsData.length, "file(s)");
      
      // Group files by step_id
      const filesByStep: Record<string, FileUpload[]> = {};
      fileUploadsData.forEach((file: any) => {
        console.log("Processing file:", {
          id: file.id,
          step_id: file.step_id,
          file_name: file.file_name,
          mime_type: file.mime_type,
          file_size: file.file_size,
          uploaded_at: file.uploaded_at,
          has_base64: !!file.base64_content,
          base64_length: file.base64_content?.length || 0
        });
        
        if (!filesByStep[file.step_id]) {
          filesByStep[file.step_id] = [];
        }
        filesByStep[file.step_id].push(file);
      });
      
      console.log("Files grouped by step:", Object.keys(filesByStep).map(stepId => ({
        stepId,
        fileCount: filesByStep[stepId].length
      })));
      
      setFileUploads(filesByStep);
      console.log("✓ File uploads loaded and grouped");
    }
    console.log("=== ADMIN REVIEW: FILE UPLOADS LOADED ===");

    setLoading(false);
  };

  const handleApprove = async () => {
    if (!submission) return;

    setProcessing(true);

    const { error } = await supabase
      .from("task_submissions")
      .update({ 
        status: "completed",
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getSession()).data.session?.user.id
      })
      .eq("id", submission.id);

    if (error) {
      console.error("Error approving submission:", error);
      toast.error("Fehler beim Genehmigen");
      setProcessing(false);
      return;
    }

    toast.success("Auftrag erfolgreich genehmigt");
    navigate("/admin/tasks");
  };

  const handleReject = async () => {
    if (!submission || !rejectionReason.trim()) {
      toast.error("Bitte geben Sie einen Ablehnungsgrund an");
      return;
    }

    if (!selectedStep) {
      toast.error("Bitte wählen Sie einen Schritt aus");
      return;
    }

    setProcessing(true);

    // Bewahre bestehende admin_data, lösche aber Navigations-State damit der
    // Mitarbeiter nicht direkt zum Quality-Check oder einem abgeschlossenen Abschnitt springt
    const existingAdminData = submission.admin_data || {};

    const { error } = await supabase
      .from("task_submissions")
      .update({ 
        status: "in_progress", // Setze auf in_progress damit Mitarbeiter weiterarbeiten kann
        notes: rejectionReason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getSession()).data.session?.user.id,
        admin_data: {
          ...existingAdminData,
          restart_from_step: selectedStep,
          rejection_timestamp: new Date().toISOString(),
          // KYC + Navigations-State zurücksetzen
          kyc_completed: false,
          kyc_completed_at: null,
          last_section: null,
          quality_check: null,
          completed_at: null,
          postal_documents_completed: false,
          postal_documents_completed_at: null,
          current_step_index: 0,
        }
      })
      .eq("id", submission.id);

    if (error) {
      console.error("Error rejecting submission:", error);
      toast.error("Fehler beim Ablehnen");
      setProcessing(false);
      return;
    }

    toast.success("Auftrag abgelehnt - Mitarbeiter wurde benachrichtigt und kann überarbeiten");
    navigate("/admin/tasks");
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!submission || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Keine Daten gefunden</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_review":
        return <Badge variant="secondary">In Prüfung</Badge>;
      case "completed":
        return <Badge variant="default">Abgeschlossen</Badge>;
      case "awaiting_review":
        return <Badge variant="outline">Zur Prüfung eingereicht</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const stepResponses = (submission.step_responses as any[]) || [];
  const allSteps = (task.steps as any[]) || [];
  const uploadSteps = allSteps.filter((step: any) => step.type === "file");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-5xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/tasks")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Übersicht
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">Auftrags-Prüfung</CardTitle>
                <CardDescription>
                  Auftrag: {task.title}
                </CardDescription>
                <CardDescription className="mt-1">
                  Mitarbeiter: {employee?.first_name} {employee?.last_name} ({employee?.email})
                </CardDescription>
              </div>
              {getStatusBadge(submission.status)}
            </div>
          </CardHeader>
        </Card>

        {/* SMS Informationen - für Admin */}
        {submission.admin_data?.sms_full_text && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                SMS-Informationen
              </CardTitle>
              <CardDescription>
                Vollständiger SMS-Text für Auftrag: {task.title}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">SMS-Code (nur Ziffern):</Label>
                  <div className="mt-1 p-3 bg-primary/10 rounded-md border border-primary/20">
                    <code className="text-lg font-mono font-bold">{submission.admin_data.sms_code}</code>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Vollständiger SMS-Text:</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md border">
                    <p className="text-sm whitespace-pre-wrap">{submission.admin_data.sms_full_text}</p>
                  </div>
                </div>
                {submission.admin_data.sms_code_received_at && (
                  <div>
                    <Label className="text-sm font-medium">Empfangen am:</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(submission.admin_data.sms_code_received_at).toLocaleString('de-DE')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Uploaded Files - nur anzeigen wenn Upload-Steps existieren */}
        {uploadSteps.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Hochgeladene Dokumente</CardTitle>
              <CardDescription>Überprüfen Sie alle eingereichten Dokumente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {uploadSteps.map((step: any) => {
                const files = fileUploads[step.id] || [];
                console.log(`Rendering step: ${step.id} (${step.title}), files:`, files.length);

                return (
                  <div key={step.id} className="border rounded-lg p-4">
                    <h4 className="font-semibold mb-2">{step.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                    
                    {files.length > 0 ? (
                      <div className="space-y-3">
                        {files.map((file: FileUpload, fileIndex: number) => {
                          const fileUrl = getFileUrl(file);
                          const isImage = file.mime_type.startsWith('image/');
                          
                          return (
                            <div key={file.id} className="border rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between p-3 bg-accent/50">
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{file.file_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(file.uploaded_at).toLocaleString('de-DE')} • {(file.file_size / 1024).toFixed(2)} KB
                                    </p>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      console.log("Opening file in new window:", file.file_name);
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        if (isImage) {
                                          console.log("Writing image to new window");
                                          newWindow.document.write(`<img src="${fileUrl}" style="max-width:100%; height:auto;" />`);
                                        } else {
                                          console.log("Setting location to data URL");
                                          newWindow.location.href = fileUrl;
                                        }
                                      } else {
                                        console.error("Failed to open new window");
                                      }
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ansehen
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      console.log("Downloading file:", file.file_name);
                                      const link = document.createElement('a');
                                      link.href = fileUrl;
                                      link.download = file.file_name;
                                      link.click();
                                      console.log("Download triggered");
                                    }}
                                  >
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                              {isImage && (
                                <div className="p-4 bg-background">
                                  <img 
                                    src={fileUrl} 
                                    alt={file.file_name}
                                    className="w-full max-w-2xl mx-auto rounded border cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                      console.log("Image clicked, opening in new window");
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`<img src="${fileUrl}" style="max-width:100%; height:auto;" />`);
                                      }
                                    }}
                                    onError={(e) => {
                                      console.error("Image failed to load:", file.file_name);
                                      console.error("Data URL length:", fileUrl.length);
                                    }}
                                    onLoad={() => {
                                      console.log("✓ Image loaded successfully:", file.file_name);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Keine Dateien hochgeladen</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Review Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Prüfungsentscheidung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Ablehnungsgrund (erforderlich bei Ablehnung)</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Geben Sie hier an, welche Dokumente nachgebessert werden müssen..."
                rows={4}
              />
            </div>

            {rejectionReason && (
              <div className="space-y-2">
                <Label htmlFor="step-select">Zurücksetzen zu Schritt</Label>
                <select
                  id="step-select"
                  value={selectedStep}
                  onChange={(e) => setSelectedStep(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  {allSteps.map((step: any, index: number) => (
                    <option key={step.id} value={step.id}>
                      Schritt {index + 1}: {step.title} ({step.type === "file" ? "Upload" : step.type === "checkbox" ? "KYC" : "Text"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Genehmigen
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Zur Überarbeitung zurücksenden
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SubmissionReview;
