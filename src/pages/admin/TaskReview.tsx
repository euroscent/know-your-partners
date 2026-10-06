import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Eye, Loader2, Download, ExternalLink } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskSubmission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  submitted_at: string;
  admin_data: any;
  step_responses: any[];
  tasks: {
    title: string;
    description?: string;
    steps: any[];
  } | null;
  profiles: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

import { FileUpload, getFileUrl } from "@/lib/fileUploadUtils";
import { computeAvailableBonuses, formatEuro, BonusItem } from "@/lib/bonusUtils";
import { Checkbox } from "@/components/ui/checkbox";

const TaskReview = () => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<TaskSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [restartFromStep, setRestartFromStep] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [fileUploads, setFileUploads] = useState<Record<string, FileUpload[]>>({});
  const [approvedBonuses, setApprovedBonuses] = useState<Record<string, boolean>>({});

  const availableBonuses: BonusItem[] = selectedSubmission
    ? computeAvailableBonuses(
        (selectedSubmission.tasks?.steps as any[]) || [],
        selectedSubmission.step_responses as any,
      )
    : [];
  const totalApprovedBonus = availableBonuses
    .filter((b) => approvedBonuses[b.id] !== false)
    .reduce((sum, b) => sum + b.amount, 0);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    console.log("=== TASK REVIEW: FETCHING SUBMISSIONS ===");
    
    const { data: submissionsData, error: submissionsError } = await supabase
      .from("task_submissions")
      .select("*, tasks!inner (title, description, steps)")
      .in("status", ["awaiting_review", "in_review"]) // Nur finale Prüfungen
      .order("submitted_at", { ascending: false });

    console.log("Submissions query result:", {
      count: submissionsData?.length || 0,
      error: submissionsError,
      submissions: submissionsData
    });

    if (submissionsError) {
      console.error("Error fetching submissions:", submissionsError);
      toast.error("Fehler beim Laden der Prüfungen");
      setLoading(false);
      return;
    }

    // Fetch profiles for all employee_ids
    const employeeIds = submissionsData?.map(s => s.employee_id) || [];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", employeeIds);

    console.log("Profiles loaded:", profilesData?.length || 0);

    // Map profiles to submissions
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
    
    const enrichedSubmissions = submissionsData?.map(sub => ({
      ...sub,
      profiles: profilesMap.get(sub.employee_id) || {
        first_name: "Unbekannt",
        last_name: "",
        email: ""
      }
    })) || [];

    setSubmissions(enrichedSubmissions as any);
    console.log("✓ Submissions loaded:", enrichedSubmissions.length);
    setLoading(false);
  };

  const fetchFilesForSubmission = async (taskId: string, employeeId: string) => {
    console.log("=== TASK REVIEW: FETCHING FILES ===");
    console.log("Task ID:", taskId);
    console.log("Employee ID:", employeeId);
    
    const { data: fileUploadsData, error: fileError } = await supabase
      .from("task_file_uploads")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", employeeId)
      .order("uploaded_at", { ascending: false });

    console.log("File uploads query result:", {
      count: fileUploadsData?.length || 0,
      error: fileError,
      data: fileUploadsData
    });

    if (fileError) {
      console.error("❌ Error fetching file uploads:", fileError);
      return;
    }

    if (fileUploadsData) {
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
    console.log("=== TASK REVIEW: FILE UPLOADS LOADED ===");
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    
    setProcessing(true);
    const { error } = await supabase
      .from("task_submissions")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        notes: reviewNotes
      })
      .eq("id", selectedSubmission.id);

    if (error) {
      console.error("Error approving submission:", error);
      toast.error("Fehler beim Genehmigen");
    } else {
      // Freelancer-Rechnung automatisch erstellen
      try {
        const approved = availableBonuses.filter((b) => approvedBonuses[b.id] !== false);
        const { error: invoiceError } = await supabase.functions.invoke("generate-freelancer-invoice", {
          body: {
            submission_id: selectedSubmission.id,
            bonus_amount: approved.reduce((sum, b) => sum + b.amount, 0),
            bonus_breakdown: approved.map((b) => ({ id: b.id, label: b.label, amount: b.amount })),
          },
        });
        if (invoiceError) {
          console.error("Error generating freelancer invoice:", invoiceError);
        }
      } catch (e) {
        console.error("Failed to call freelancer invoice function:", e);
      }
      
      toast.success("Aufgabe genehmigt!");
      setSelectedSubmission(null);
      setReviewNotes("");
      fetchSubmissions();
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    if (!reviewNotes.trim()) {
      toast.error("Bitte geben Sie einen Grund für die Ablehnung an");
      return;
    }
    if (!restartFromStep) {
      toast.error("Bitte wählen Sie einen Schritt aus, bei dem der Mitarbeiter neu starten soll");
      return;
    }
    
    setProcessing(true);
    
    // Preserve existing admin_data and add restart_from_step
    const existingAdminData = selectedSubmission.admin_data || {};
    
    const { error } = await supabase
      .from("task_submissions")
      .update({
        status: "in_progress", // Setze auf in_progress damit Mitarbeiter weiterarbeiten kann
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        notes: reviewNotes,
        admin_data: {
          ...existingAdminData,
          restart_from_step: restartFromStep,
          rejection_timestamp: new Date().toISOString(),
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
      .eq("id", selectedSubmission.id);

    if (error) {
      console.error("Error rejecting submission:", error);
      toast.error("Fehler beim Ablehnen");
    } else {
      toast.success("Aufgabe abgelehnt - Mitarbeiter wurde benachrichtigt und kann überarbeiten");
      setSelectedSubmission(null);
      setReviewNotes("");
      setRestartFromStep("");
      fetchSubmissions();
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Lädt Prüfungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Aufgaben-Prüfung</CardTitle>
          <CardDescription>
            Überprüfen Sie eingereichte Aufgaben von Mitarbeitern
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine ausstehenden Prüfungen</h3>
              <p className="text-muted-foreground">
                Alle Aufgaben wurden bereits geprüft
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mitarbeiter</TableHead>
                  <TableHead>Aufgabe</TableHead>
                  <TableHead>Eingereicht am</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {submission.profiles.first_name} {submission.profiles.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {submission.profiles.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {submission.tasks?.title || "Unbekannter Auftrag"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {submission.tasks?.steps?.length || 0} Schritte
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(submission.submitted_at).toLocaleString("de-DE")}
                    </TableCell>
                    <TableCell>
                      {submission.status === "awaiting_review" ? (
                        <Badge variant="outline">Zur Prüfung eingereicht</Badge>
                      ) : submission.status === "in_review" ? (
                        <Badge variant="secondary">In Prüfung</Badge>
                      ) : (
                        <Badge variant="secondary">{submission.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log("=== OPENING SUBMISSION REVIEW ===");
                          console.log("Submission ID:", submission.id);
                          console.log("Task ID:", submission.task_id);
                          console.log("Employee ID:", submission.employee_id);
                          setSelectedSubmission(submission);
                          setApprovedBonuses({});
                          fetchFilesForSubmission(submission.task_id, submission.employee_id);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Prüfen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog 
        open={!!selectedSubmission} 
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSubmission(null);
            setFileUploads({});
          } else if (selectedSubmission) {
            fetchFilesForSubmission(selectedSubmission.task_id, selectedSubmission.employee_id);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aufgabe prüfen</DialogTitle>
            <DialogDescription>
              Bewertungsprotokoll von {selectedSubmission?.profiles.first_name} {selectedSubmission?.profiles.last_name}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* Uploaded Documents from task_file_uploads */}
              {selectedSubmission.tasks?.steps && 
               selectedSubmission.tasks.steps.some((step: any) => step.type === "file") && (
                <div>
                  <h4 className="font-semibold mb-3">Hochgeladene Dokumente</h4>
                  <div className="space-y-4">
                    {selectedSubmission.tasks.steps
                      .filter((step: any) => step.type === "file")
                      .map((step: any) => {
                        const files = fileUploads[step.id] || [];
                        console.log(`Rendering step: ${step.id} (${step.title}), files:`, files.length);
                        
                        return (
                          <div key={step.id} className="border rounded-lg p-4">
                            <h5 className="font-medium mb-2">{step.title}</h5>
                            <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                            
                            {files.length > 0 ? (
                              <div className="space-y-3">
                                {files.map((file: FileUpload) => {
                                  const fileUrl = getFileUrl(file);
                                  const isImage = file.mime_type.startsWith('image/');
                                  
                                  return (
                                    <div key={file.id} className="border rounded-lg overflow-hidden">
                                      <div className="flex items-center justify-between p-3 bg-accent/50">
                                        <div className="flex items-center gap-3">
                                          <Eye className="h-5 w-5 text-muted-foreground" />
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
                                                  newWindow.document.write(`<img src="${fileUrl}" style="max-width:100%; height:auto;" />`);
                                                } else {
                                                  newWindow.location.href = fileUrl;
                                                }
                                              }
                                            }}
                                          >
                                            <ExternalLink className="h-4 w-4 mr-1" />
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
                                              const newWindow = window.open();
                                              if (newWindow) {
                                                newWindow.document.write(`<img src="${fileUrl}" style="max-width:100%; height:auto;" />`);
                                              }
                                            }}
                                            onError={() => console.error("Image load failed:", file.file_name)}
                                            onLoad={() => console.log("Image loaded:", file.file_name)}
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
                  </div>
                </div>
              )}

              <div>
                <Label>Notizen für Mitarbeiter (Pflicht bei Ablehnung)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Feedback für den Mitarbeiter..."
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div>
                <Label>Neustart bei Schritt (für Ablehnung)</Label>
                <Select value={restartFromStep} onValueChange={setRestartFromStep}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Schritt auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedSubmission?.tasks.steps?.map((step: any, index: number) => (
                      <SelectItem key={step.id} value={step.id}>
                        Schritt {index + 1}: {step.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Wähle den Schritt aus, bei dem der Mitarbeiter neu beginnen soll
                </p>
              </div>

              {/* Bonus-Freigabe für Honorarabrechnung */}
              {availableBonuses.length > 0 && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">
                        Bonus-Freigabe für Honorarabrechnung
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Wählen Sie aus, welche vom Mitarbeiter beanspruchten Boni ausgezahlt werden.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Genehmigt</p>
                      <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                        + {formatEuro(totalApprovedBonus)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {availableBonuses.map((b) => {
                      const checked = approvedBonuses[b.id] !== false;
                      return (
                        <label
                          key={b.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-md border border-border bg-background cursor-pointer hover:bg-accent/40 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                setApprovedBonuses((prev) => ({ ...prev, [b.id]: v !== false }))
                              }
                            />
                            <span className="text-sm truncate">{b.label}</span>
                          </div>
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              checked ? "text-emerald-600" : "text-muted-foreground line-through"
                            }`}
                          >
                            + {formatEuro(b.amount)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setSelectedSubmission(null)}
                  disabled={processing}
                >
                  Abbrechen
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={processing}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Ablehnen
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                >
                  {processing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Genehmigen
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskReview;
