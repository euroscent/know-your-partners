import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Eye, Loader2, Download, ExternalLink, Info, Phone, Mail, Key, Image as ImageIcon, User, Lock } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import EmployeeDetailDialog from "@/components/admin/EmployeeDetailDialog";

interface ReviewTabProps {
  onUpdate?: () => void;
}

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
    send_completion_email?: boolean;
    template_id?: string | null;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
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

const ReviewTab = ({ onUpdate }: ReviewTabProps) => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<TaskSubmission | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [restartFromStep, setRestartFromStep] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [fileUploads, setFileUploads] = useState<Record<string, FileUpload[]>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
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

    // Real-time subscription
    const channel = supabase
      .channel('review-submissions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_submissions' },
        () => {
          fetchSubmissions();
          onUpdate?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSubmissions = async () => {
    const { data: submissionsData, error } = await supabase
      .from("task_submissions")
      .select("*, tasks!inner (title, description, steps, send_completion_email, template_id, logo_url, primary_color, secondary_color, accent_color)")
      .in("status", ["awaiting_review", "in_review", "kyc_completed"])
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Fehler beim Laden der Prüfungen");
      setLoading(false);
      return;
    }

    const employeeIds = submissionsData?.map(s => s.employee_id) || [];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", employeeIds);

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
    setLoading(false);
  };

  const fetchFilesForSubmission = async (taskId: string, employeeId: string) => {
    const { data: fileUploadsData, error } = await supabase
      .from("task_file_uploads")
      .select("*")
      .eq("task_id", taskId)
      .eq("user_id", employeeId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error("Error fetching file uploads:", error);
      return;
    }

    const filesByStep: Record<string, FileUpload[]> = {};
    fileUploadsData?.forEach((file: any) => {
      if (!filesByStep[file.step_id]) {
        filesByStep[file.step_id] = [];
      }
      filesByStep[file.step_id].push(file);
    });
    
    setFileUploads(filesByStep);
  };

  const autoSendCompletionEmail = async (submission: TaskSubmission) => {
    const taskId = submission.task_id;
    const templateId = submission.tasks?.template_id;

    // Resolve completion template
    const idsToTry = [templateId, taskId].filter(Boolean) as string[];
    const { data: dbTemplates } = await supabase
      .from("task_email_templates")
      .select("*")
      .eq("email_type", "completion")
      .eq("is_active", true)
      .in("task_id", idsToTry)
      .order("updated_at", { ascending: false });

    const template = dbTemplates?.[0];

    const defaultContent = `<p>Hallo ${submission.profiles.first_name},</p><p>herzlichen Glückwunsch! Sie haben den Auftrag <strong>"${submission.tasks?.title}"</strong> erfolgreich abgeschlossen.</p><p>Vielen Dank für Ihre hervorragende Arbeit.</p><p>Die Vergütung wird in Kürze auf Ihr Konto überwiesen.</p><p>Mit freundlichen Grüßen,<br/><strong>Das EPP HR-Team</strong></p>`;

    let subject = template?.subject || `Auftrag "${submission.tasks?.title}" erfolgreich abgeschlossen`;
    let content = template?.content || defaultContent;
    const senderEmail = template?.sender_email || "info@epp-support.de";
    const senderName = template?.sender_name || "EPP";

    // Replace placeholders
    const firstName = submission.profiles.first_name || "";
    const lastName = submission.profiles.last_name || "";
    const taskTitle = submission.tasks?.title || "";
    const adminData = (submission.admin_data || {}) as Record<string, any>;
    const identCode = adminData.ident_code || "";

    const replacePlaceholders = (text: string) =>
      text
        .replace(/{vorname}/gi, firstName)
        .replace(/\[vorname\]/gi, firstName)
        .replace(/{nachname}/gi, lastName)
        .replace(/\[nachname\]/gi, lastName)
        .replace(/{auftrag}/gi, taskTitle)
        .replace(/\[auftrag\]/gi, taskTitle)
        .replace(/{name}/gi, `${firstName} ${lastName}`.trim())
        .replace(/\[name\]/gi, `${firstName} ${lastName}`.trim())
        .replace(/{vorgangsnummer}/gi, identCode)
        .replace(/\[vorgangsnummer\]/gi, identCode)
        .replace(/{ident_code}/gi, identCode)
        .replace(/\[ident_code\]/gi, identCode);

    subject = replacePlaceholders(subject);
    content = replacePlaceholders(content);

    // Resolve recipient email (task email > generated email > profile email)
    let recipientEmail = submission.profiles.email;

    const { data: genEmail } = await supabase
      .from("generated_emails")
      .select("full_address")
      .eq("submission_id", submission.id)
      .eq("is_active", true)
      .maybeSingle();

    if (genEmail?.full_address) recipientEmail = genEmail.full_address;

    const isHtmlTemplate = /<html>|<style>|<table|<head|<!DOCTYPE/i.test(content);

    await supabase.functions.invoke("send-task-completion-email", {
      body: {
        to: recipientEmail,
        firstName,
        lastName,
        taskTitle,
        subject,
        content,
        isHtmlTemplate,
        submissionId: submission.id,
        taskId: submission.task_id,
        senderEmail,
        senderName,
        primaryColor: submission.tasks?.primary_color || "#22c55e",
        secondaryColor: submission.tasks?.secondary_color || "#ffffff",
        accentColor: submission.tasks?.accent_color || "#16a34a",
        logoUrl: submission.tasks?.logo_url,
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("task_completion_emails_sent").insert({
      submission_id: submission.id,
      template_id: template?.id || null,
      recipient_email: recipientEmail,
      recipient_name: `${firstName} ${lastName}`,
      subject,
      content,
      sent_by: user?.id,
    });

    toast.success("Abschluss-E-Mail automatisch versendet");
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
      toast.error("Fehler beim Genehmigen");
    } else {
      try {
        const approved = availableBonuses.filter((b) => approvedBonuses[b.id] !== false);
        await supabase.functions.invoke("generate-freelancer-invoice", {
          body: {
            submission_id: selectedSubmission.id,
            bonus_amount: approved.reduce((sum, b) => sum + b.amount, 0),
            bonus_breakdown: approved.map((b) => ({ id: b.id, label: b.label, amount: b.amount })),
          },
        });
      } catch (e) {
        console.error("Failed to call freelancer invoice function:", e);
      }

      // Auto-send completion email if toggle is active
      if (selectedSubmission.tasks?.send_completion_email) {
        try {
          await autoSendCompletionEmail(selectedSubmission);
        } catch (e) {
          console.error("Failed to auto-send completion email:", e);
        }
      }
      
      toast.success("Aufgabe genehmigt!");
      setSelectedSubmission(null);
      setReviewNotes("");
      fetchSubmissions();
      onUpdate?.();
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
    const existingAdminData = selectedSubmission.admin_data || {};
    
    const { error } = await supabase
      .from("task_submissions")
      .update({
        status: "in_progress",
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        notes: reviewNotes,
        admin_data: {
          ...existingAdminData,
          restart_from_step: restartFromStep,
          rejection_timestamp: new Date().toISOString(),
          // KYC + Navigation zurücksetzen, damit Mitarbeiter neu durch den Flow geführt wird
          kyc_completed: false,
          kyc_completed_at: null,
          last_section: null,
          quality_check: null,
          quality_check_completed_at: null,
          completed_at: null,
          postal_documents_completed: false,
          postal_documents_completed_at: null,
          current_step_index: 0,
        }
      })
      .eq("id", selectedSubmission.id);

    if (error) {
      toast.error("Fehler beim Ablehnen");
    } else {
      toast.success("Aufgabe abgelehnt - Mitarbeiter wurde benachrichtigt");
      setSelectedSubmission(null);
      setReviewNotes("");
      setRestartFromStep("");
      fetchSubmissions();
      onUpdate?.();
    }
    setProcessing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Aufgaben-Prüfung
          </CardTitle>
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
                        <button
                          className="font-medium text-left hover:text-primary hover:underline transition-colors cursor-pointer"
                          onClick={() => {
                            setSelectedEmployeeId(submission.employee_id);
                            setEmployeeDialogOpen(true);
                          }}
                        >
                          {submission.profiles.first_name} {submission.profiles.last_name}
                        </button>
                        <div className="text-sm text-muted-foreground">
                          {submission.profiles.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {submission.tasks?.title || "Unbekannt"}
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
                      {submission.status === "kyc_completed" ? (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          KYC fertig – Admin-Prüfung offen
                        </Badge>
                      ) : submission.status === "awaiting_review" ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Zur Prüfung
                        </Badge>
                      ) : (
                        <Badge variant="secondary">In Prüfung</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
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
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aufgabe prüfen</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.profiles.first_name} {selectedSubmission?.profiles.last_name} - {selectedSubmission?.tasks?.title}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* File uploads section */}
              {selectedSubmission.tasks?.steps?.some((step: any) => step.type === "file") && (
                <div>
                  <h4 className="font-semibold mb-3">Hochgeladene Dokumente</h4>
                  <div className="space-y-4">
                    {selectedSubmission.tasks.steps
                      .filter((step: any) => step.type === "file")
                      .map((step: any) => {
                        const files = fileUploads[step.id] || [];
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
                                        <div>
                                          <p className="text-sm font-medium">{file.file_name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {(file.file_size / 1024).toFixed(2)} KB
                                          </p>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                              const newWindow = window.open();
                                              if (newWindow) {
                                          if (isImage) {
                                                  newWindow.document.write(`<img src="${fileUrl}" />`);
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
                                            className="w-full max-w-2xl mx-auto rounded border"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">Keine Dateien</p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Demo-Daten Info */}
              {selectedSubmission.admin_data && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Info className="h-4 w-4 text-primary" />
                    Hinterlegte Demo-Daten
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {/* Ident Codes */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      const codes = ad.ident_codes || (ad.ident_code ? [ad.ident_code] : []);
                      if (codes.length === 0) return null;
                      return (
                        <div className="flex items-start gap-2">
                          <Key className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span className="text-muted-foreground">Ident-Codes:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {codes.map((code: string, i: number) => (
                                <Badge key={i} variant="secondary" className="font-mono text-xs">{code}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Phone */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      const phone = ad.phone || ad.assigned_phone;
                      if (!phone) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Telefon:</span>
                          <span className="font-mono">{phone}</span>
                        </div>
                      );
                    })()}

                    {/* Email */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      const email = ad.email || ad.assigned_email;
                      if (!email) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">E-Mail:</span>
                          <span className="font-mono text-xs">{email}</span>
                        </div>
                      );
                    })()}

                    {/* Username */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      if (!ad.username) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Benutzername:</span>
                          <span className="font-mono">{ad.username}</span>
                        </div>
                      );
                    })()}

                    {/* Password */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      if (!ad.password) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Passwort:</span>
                          <span className="font-mono">{ad.password}</span>
                        </div>
                      );
                    })()}

                    {/* Passcode */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      if (!ad.passcode) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Passcode:</span>
                          <span className="font-mono">{ad.passcode}</span>
                        </div>
                      );
                    })()}

                    {/* Images count */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      const images = ad.image_urls || [];
                      if (images.length === 0) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">Bilder:</span>
                          <span>{images.length} hinterlegt</span>
                        </div>
                      );
                    })()}

                    {/* Info text */}
                    {(() => {
                      const ad = selectedSubmission.admin_data as Record<string, any>;
                      const info = ad.info_text || ad.info;
                      if (!info) return null;
                      return (
                        <div className="col-span-full flex items-start gap-2">
                          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="w-full">
                            <span className="text-muted-foreground">Anweisungen:</span>
                            <div className="mt-1 max-h-32 overflow-y-auto rounded border border-border bg-background p-2">
                              <p className="text-xs whitespace-pre-wrap">{typeof info === 'string' ? info : ''}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {Object.keys(selectedSubmission.admin_data as Record<string, any>).filter(k => !['ident_code', 'ident_codes', 'phone', 'assigned_phone', 'email', 'assigned_email', 'username', 'password', 'passcode', 'image_urls', 'info_text', 'info', 'demo_data_updated_at', 'restart_from_step', 'rejection_timestamp', 'quality_check', 'last_section', 'current_step_index'].includes(k)).length === 0 && !selectedSubmission.admin_data ? (
                    <p className="text-sm text-muted-foreground">Keine Demo-Daten hinterlegt</p>
                  ) : null}
                </div>
              )}

              <div>
                <Label>Notizen für Mitarbeiter (Pflicht bei Ablehnung)</Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    "Screenshot fehlt oder ist unvollständig",
                    "Falscher Account / falsche Daten verwendet",
                    "Aufgabe nicht korrekt ausgeführt",
                    "Verifizierung nicht abgeschlossen",
                    "Bilder sind unscharf oder nicht lesbar",
                    "Schritte wurden übersprungen",
                  ].map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50 hover:bg-primary/10 hover:border-primary/30 transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setReviewNotes(prev => prev ? `${prev}\n${text}` : text)}
                    >
                      {text}
                    </button>
                  ))}
                </div>
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
                    {selectedSubmission?.tasks?.steps?.map((step: any, index: number) => (
                      <SelectItem key={step.id} value={step.id}>
                        Schritt {index + 1}: {step.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <EmployeeDetailDialog
        employeeId={selectedEmployeeId}
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
      />
    </>
  );
};

export default ReviewTab;
