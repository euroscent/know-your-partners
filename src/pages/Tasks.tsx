import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, CheckSquare, ArrowRight, Eye, Copy, AlertTriangle, Clock, Star, Building2, Euro } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { motion } from "framer-motion";
import { getTaskGlowStyles, getBannerUrls, hasDemoDataInAdminData } from "@/lib/taskUtils";
import { DeadlineBadge } from "@/components/DeadlineBadge";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  tags: string[];
  due_date: string | null;
  estimated_hours: number | null;
  compensation_amount: number | null;
  steps?: any;
  created_at: string;
  image_url?: string | null;
  images?: unknown;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  is_starter_job?: boolean | null;
  /** Signed/public URL computed client-side */
  banner_url?: string | null;
  /** All banner candidates (signed/public), in display order */
  banner_urls?: string[];
}

interface TaskSubmission {
  id: string;
  task_id: string;
  status: string;
  admin_data: any;
  notes?: string;
}

const Tasks = () => {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, TaskSubmission>>({});
  const [selectedDemoData, setSelectedDemoData] = useState<any>(null);
  const [isFreelancer, setIsFreelancer] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchTasks();

    // Subscribe to task updates for real-time sync
    const channel = supabase
      .channel('task-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          // Refetch tasks when any task is updated
          checkAuthAndFetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuthAndFetchTasks = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Determine whether the current user is a freelancer (drives compensation visibility)
    const { data: profile } = await supabase
      .from("profiles")
      .select("employment_type")
      .eq("id", session.user.id)
      .maybeSingle();
    const empType = (profile?.employment_type || "").toLowerCase();
    setIsFreelancer(empType === "freelancer" || empType === "freelance");

    // Fetch tasks assigned to this user
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("assigned_to", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching tasks:", error);
      setLoading(false);
      return;
    }

    // Strong cache-busting: ensure updated images show immediately even if
    // the task's updated_at didn't change (or the browser cached aggressively).
    const cacheBuster = Date.now().toString();

    // Compute banner_url(s) for each task using shared utility
    const tasksWithBanners = await Promise.all(
      (data || []).map(async (t: any) => {
        const banner_urls = await getBannerUrls(t, cacheBuster);
        const banner_url = banner_urls[0] ?? null;
        return { ...t, banner_url, banner_urls } as Task;
      })
    );

    setTasks(tasksWithBanners);

    // Fetch submissions for these tasks
    if (tasksWithBanners.length > 0) {
      const taskIds = tasksWithBanners.map((t) => t.id);
      const { data: submissionsData } = await supabase
        .from("task_submissions")
        .select("*")
        .eq("employee_id", session.user.id)
        .in("task_id", taskIds);

      const submissionsMap: Record<string, TaskSubmission> = {};
      submissionsData?.forEach((sub: any) => {
        submissionsMap[sub.task_id] = sub;
      });
      setSubmissions(submissionsMap);
    }

    setLoading(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} kopiert`);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Hoch";
      case "medium":
        return "Mittel";
      case "low":
        return "Niedrig";
      default:
        return priority;
    }
  };

  const getStatusInfo = (submission: TaskSubmission | undefined) => {
    if (!submission) return null;
    
    if (submission.status === "approved" || submission.status === "completed") {
      return { label: "Genehmigt", variant: "default" as const };
    }
    if (submission.status === "in_review" || submission.status === "awaiting_review") {
      return { label: "In Prüfung", variant: "warning" as const };
    }
    if (submission.status === "pending") {
      return null;
    }
    // Nur als "Überarbeitung nötig" markieren wenn rejection_timestamp gesetzt ist
    // Admin-Notizen alleine triggern KEINE Überarbeitung mehr
    const adminData = (submission.admin_data || {}) as Record<string, unknown>;
    const wasRejected = !!(adminData.rejection_timestamp || adminData.restart_from_step);
    if (submission.status === "in_progress" && wasRejected) {
      return { label: "Überarbeitung nötig", variant: "destructive" as const };
    }
    if (submission.status === "in_progress") {
      return { label: "In Bearbeitung", variant: "outline" as const };
    }
    if (submission.status === "kyc_completed") {
      return { label: "KYC abgeschlossen", variant: "outline" as const };
    }
    return { label: submission.status, variant: "secondary" as const };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lade Aufträge...</p>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks
    .filter((task) => {
      const submission = submissions[task.id];
      return !submission || (submission.status !== "approved" && submission.status !== "completed");
    })
    .sort((a, b) => {
      const aSub = submissions[a.id];
      const bSub = submissions[b.id];
      const aAdminData = (aSub?.admin_data || {}) as Record<string, unknown>;
      const bAdminData = (bSub?.admin_data || {}) as Record<string, unknown>;
      const aHasDemo = hasDemoDataInAdminData(aAdminData, aSub?.status) || aSub?.status === "pending";
      const bHasDemo = hasDemoDataInAdminData(bAdminData, bSub?.status) || bSub?.status === "pending";
      return (bHasDemo ? 1 : 0) - (aHasDemo ? 1 : 0);
    });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zum Dashboard
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Meine Aufträge
              </h1>
              <p className="text-muted-foreground">
                Hier finden Sie alle Ihre zugewiesenen Aufträge
              </p>
            </div>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Keine offenen Aufträge</h3>
              <p className="text-muted-foreground">
                {tasks.length === 0 
                  ? "Ihnen wurden noch keine Aufträge zugewiesen" 
                  : "Alle Ihre Aufträge wurden bereits genehmigt"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTasks.map((task, index) => {
              const submission = submissions[task.id];
              const statusInfo = getStatusInfo(submission);
              const isCompleted = submission?.status === "approved" || submission?.status === "completed";
              const isInReview = submission?.status === "awaiting_review" || submission?.status === "in_review";
              
              // Check for demo data using shared utility
              const adminData = (submission?.admin_data || {}) as Record<string, unknown>;
              const hasDemoData = hasDemoDataInAdminData(adminData, submission?.status) || submission?.status === "pending";
              
              // Detect rejected tasks only if NOT already resubmitted for review
              // Admin-Notizen alleine triggern KEINE Überarbeitung - nur rejection_timestamp
              const needsRevision = !isInReview && 
                !!(adminData.restart_from_step || adminData.rejection_timestamp);
              
              // Glow styles using shared utility
              const glowStyles = getTaskGlowStyles({
                isRejected: !!needsRevision,
                isInReview,
                hasDemoData,
                isCompleted
              });
              
              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  whileHover={{ scale: 1.02, y: -4 }}
                  className="h-full"
                >
                  <Card className={`overflow-hidden transition-all duration-500 group cursor-pointer h-full flex flex-col ${glowStyles}`}
                    onClick={() => {
                      if (isCompleted) return;
                      if (submission?.status === "awaiting_review" || submission?.status === "in_review") return;
                      if (submission?.status === "pending") {
                        navigate(`/dashboard/tasks/${task.id}/demo-data`);
                      } else {
                        navigate(`/dashboard/tasks/${task.id}`);
                      }
                    }}
                  >
                    {/* Image Banner */}
                    <div 
                      className="relative h-40 overflow-hidden"
                      style={{
                        background: task.primary_color
                          ? `linear-gradient(135deg, ${task.primary_color}, ${task.secondary_color || task.primary_color}88)`
                          : undefined
                      }}
                    >
                      {!task.primary_color && (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
                      )}
                      {task.banner_url ? (
                        <img 
                          src={task.banner_url} 
                          alt={task.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="h-16 w-16 text-primary/30" />
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      
                      {/* Starter Job Badge */}
                      {task.is_starter_job && (
                        <Badge className="absolute top-3 right-3 bg-primary/90 hover:bg-primary text-primary-foreground border-0 shadow-lg">
                          <Star className="h-3 w-3 mr-1" />
                          Starter-Job
                        </Badge>
                      )}
                      
                    </div>

                    {/* Content */}
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {task.description}
                          </p>
                        )}
                        
                        {/* Deadline – nur nach Eingang der Demo-Daten */}
                        {task.due_date && !isCompleted && (adminData.demo_data_provided_at || adminData.demo_data_requested_at) && (
                          <div className="mb-3">
                            <DeadlineBadge dueDate={task.due_date} />
                          </div>
                        )}

                        {/* Freelancer Compensation (with bonus range) */}
                        {isFreelancer && task.compensation_amount != null && Number(task.compensation_amount) > 0 && (() => {
                          const base = Number(task.compensation_amount);
                          let maxBonus = 0;
                          for (const step of (Array.isArray(task.steps) ? task.steps : []) as any[]) {
                            if (step?.ask_postal_consent && step?.postal_consent_bonus) {
                              maxBonus += Number(step.postal_consent_bonus) || 0;
                            }
                            if (step?.ask_id_document && step?.id_document_bonus) {
                              const vals = Object.values(step.id_document_bonus).map((v) => Number(v ?? 0));
                              if (vals.length) maxBonus += Math.max(...vals);
                            }
                          }
                          const total = base + maxBonus;
                          const fmt = (n: number) =>
                            n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                          return (
                            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                              <Euro className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                                Vergütung: {maxBonus > 0 ? `${fmt(base)} € – ${fmt(total)} €` : `${fmt(base)} €`}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Rejection Notice */}
                        {needsRevision && submission?.notes && (
                          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-lg mb-3">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-destructive/80 line-clamp-2">{submission.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{task.estimated_hours || 0}h</span>
                        </div>
                        
                        {!isCompleted && !(submission?.status === "awaiting_review" || submission?.status === "in_review") && (
                          <Button 
                            size="sm"
                            variant={needsRevision ? "destructive" : "default"}
                            className="group-hover:translate-x-1 transition-transform"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (submission?.status === "pending") {
                                navigate(`/dashboard/tasks/${task.id}/demo-data`);
                              } else {
                                navigate(`/dashboard/tasks/${task.id}`);
                              }
                            }}
                          >
                            {needsRevision ? "Überarbeiten" : "Details"}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Demo Data Dialog */}
      <Dialog open={!!selectedDemoData} onOpenChange={() => setSelectedDemoData(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Demo-Daten für Auftrag</DialogTitle>
            <DialogDescription>
              Verwenden Sie diese Zugangsdaten zur Bearbeitung des Auftrags
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedDemoData?.email && (
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex gap-2">
                  <Input 
                    value={selectedDemoData.email} 
                    readOnly 
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(selectedDemoData.email, "Email")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedDemoData?.password && (
              <div className="space-y-2">
                <Label>Passwort</Label>
                <div className="flex gap-2">
                  <Input 
                    value={selectedDemoData.password} 
                    readOnly 
                    type="text"
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(selectedDemoData.password, "Passwort")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedDemoData?.passcode && (
              <div className="space-y-2">
                <Label>Passcode</Label>
                <div className="flex gap-2">
                  <Input 
                    value={selectedDemoData.passcode} 
                    readOnly 
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(selectedDemoData.passcode, "Passcode")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedDemoData?.image_url && (
              <div className="space-y-2">
                <Label>Demo Bild</Label>
                <div className="border rounded-lg p-4">
                  <img 
                    src={selectedDemoData.image_url} 
                    alt="Demo Bild" 
                    className="max-h-48 mx-auto rounded"
                  />
                  <div className="flex gap-2 mt-2 justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a 
                        href={selectedDemoData.image_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Vollbild ansehen
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(selectedDemoData.image_url, "Bild-URL")}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      URL kopieren
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedDemoData?.ident_code && (
              <div className="space-y-2">
                <Label>Ident Code</Label>
                <div className="flex gap-2">
                  <Input 
                    value={selectedDemoData.ident_code} 
                    readOnly 
                    className="flex-1"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => copyToClipboard(selectedDemoData.ident_code, "Ident Code")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {selectedDemoData?.ident_link && (
              <div className="space-y-2">
                <Label>Ident Link</Label>
                <div className="flex gap-2">
                  <Input 
                    value={selectedDemoData.ident_link} 
                    readOnly 
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    <Button 
                      variant="outline" 
                      size="sm"
                      asChild
                    >
                      <a 
                        href={selectedDemoData.ident_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Öffnen
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => copyToClipboard(selectedDemoData.ident_link, "Ident Link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedDemoData?.internal_notes && (
              <div className="space-y-2">
                <Label>Interne Notizen</Label>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedDemoData.internal_notes}</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
