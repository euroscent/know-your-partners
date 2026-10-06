import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { List, Clock, CheckCircle2, PlayCircle, AlertCircle, Eye, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { format } from "date-fns";
import DemoDataDialog from "@/components/admin/DemoDataDialog";
import EmployeeDetailDialog from "@/components/admin/EmployeeDetailDialog";

interface AllTasksTabProps {
  onUpdate?: () => void;
}

interface Submission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  submitted_at: string;
  updated_at: string;
  admin_data: any;
  tasks: {
    id: string;
    title: string;
  } | null;
  employee?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const getStatusBadge = (status: string, hasDemoData: boolean = false) => {
  switch (status) {
    case "assigned":
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
          <PlayCircle className="h-3 w-3 mr-1" />
          Neu zugewiesen
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Clock className="h-3 w-3 mr-1" />
          Warte auf Demo-Daten
        </Badge>
      );
    case "in_progress":
      return (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <PlayCircle className="h-3 w-3 mr-1" />
            In Bearbeitung
          </Badge>
          {hasDemoData && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Demo ergänzt
            </Badge>
          )}
        </div>
      );
    case "awaiting_review":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Zur Prüfung
        </Badge>
      );
    case "in_review":
      return (
        <Badge variant="secondary">
          <Eye className="h-3 w-3 mr-1" />
          In Prüfung
        </Badge>
      );
    case "approved":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Genehmigt
        </Badge>
      );
    case "kyc_completed":
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <AlertCircle className="h-3 w-3 mr-1" />
          Zur Admin-Prüfung
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const AllTasksTab = ({ onUpdate }: AllTasksTabProps) => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);

  useEffect(() => {
    fetchSubmissions();

    // Real-time subscription
    const channel = supabase
      .channel('all-tasks-submissions')
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
    // Parallel fetch: admin IDs + submissions + assigned tasks + all submission keys
    const [adminRolesResult, submissionsResult, assignedTasksResult, allSubmissionKeysResult] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase
        .from("task_submissions")
        .select(`
          id, task_id, employee_id, status, submitted_at, updated_at, admin_data,
          tasks!inner ( id, title )
        `)
        .neq("status", "approved")
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("tasks")
        .select("id, title, assigned_to, updated_at, created_at")
        .not("assigned_to", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase
        .from("task_submissions")
        .select("task_id, employee_id, status")
        .limit(2000)
    ]);

    const adminIds = new Set(adminRolesResult.data?.map(r => r.user_id) || []);

    if (submissionsResult.error) {
      console.error("Error fetching submissions:", submissionsResult.error);
      toast.error("Fehler beim Laden");
      setLoading(false);
      return;
    }

    // Filter out admin submissions
    const filteredSubmissions = (submissionsResult.data as any[])?.filter(sub => 
      sub.tasks != null && !adminIds.has(sub.employee_id)
    ) || [];

    // Build set of (task_id|employee_id) for ANY existing submission (incl. approved)
    // so we don't synthesize pseudo-submissions for already-completed assignments.
    const allSubmissionKeys = new Set(
      ((allSubmissionKeysResult.data as any[]) || []).map(s => `${s.task_id}|${s.employee_id}`)
    );

    // Synthesize pseudo-submissions for assigned tasks without a submission yet
    const pseudoSubmissions = ((assignedTasksResult.data as any[]) || [])
      .filter(t => t.assigned_to && !adminIds.has(t.assigned_to))
      .filter(t => !allSubmissionKeys.has(`${t.id}|${t.assigned_to}`))
      .map(t => ({
        id: `pseudo-${t.id}-${t.assigned_to}`,
        task_id: t.id,
        employee_id: t.assigned_to,
        status: "assigned",
        submitted_at: t.created_at,
        updated_at: t.updated_at || t.created_at,
        admin_data: null,
        tasks: { id: t.id, title: t.title },
      }));

    const allSubmissions = [...filteredSubmissions, ...pseudoSubmissions]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    // Fetch employee profiles in parallel
    const employeeIds = [...new Set(allSubmissions.map(s => s.employee_id))];
    
    if (employeeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", employeeIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]));

      const enrichedSubmissions = allSubmissions.map(sub => ({
        ...sub,
        employee: profilesMap.get(sub.employee_id) || {
          first_name: "Unbekannt",
          last_name: "",
          email: ""
        }
      }));

      setSubmissions(enrichedSubmissions);
    } else {
      setSubmissions([]);
    }
    
    setLoading(false);
  };

  const handleOpenSubmission = async (submission: Submission) => {
    let submissionId = submission.id;
    // If pseudo (no real submission yet), create one first
    if (submissionId.startsWith("pseudo-")) {
      const { data, error } = await supabase
        .from("task_submissions")
        .insert({
          task_id: submission.task_id,
          employee_id: submission.employee_id,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !data) {
        console.error(error);
        toast.error("Fehler beim Erstellen der Anfrage");
        return;
      }
      submissionId = data.id;
    }
    setSelectedSubmissionId(submissionId);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedSubmissionId(null);
    }
  };

  const handleSaved = () => {
    fetchSubmissions();
    onUpdate?.();
  };

  const handleMarkKycCompleted = async (submission: Submission) => {
    if (!confirm(`KYC für "${submission.tasks?.title}" als bestätigt markieren? Der Mitarbeiter überspringt die Demo-Console und muss zuerst das QS-Protokoll ausfüllen, bevor er den Auftrag abschließen kann.`)) {
      return;
    }
    const completedAt = new Date().toISOString();
    const existingAdminData = submission.admin_data || {};
    const { error } = await supabase
      .from("task_submissions")
      .update({
        status: "in_progress",
        admin_data: {
          ...existingAdminData,
          kyc_completed: true,
          kyc_completed_at: completedAt,
          kyc_marked_by_admin: true,
          last_section: "quality_check",
          quality_check: null,
        },
      })
      .eq("id", submission.id);

    if (error) {
      console.error(error);
      toast.error("Fehler beim Markieren");
      return;
    }
    toast.success("KYC bestätigt – Mitarbeiter muss jetzt das QS-Protokoll ausfüllen");
    fetchSubmissions();
    onUpdate?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <>
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          Alle laufenden Aufträge
        </CardTitle>
        <CardDescription>
          Übersicht aller aktiven Aufträge und deren Status
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <List className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine laufenden Aufträge</h3>
            <p className="text-muted-foreground">
              Derzeit sind keine aktiven Aufträge vorhanden
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitarbeiter</TableHead>
                <TableHead>Aufgabe</TableHead>
                <TableHead>Letzte Aktualisierung</TableHead>
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
                        {submission.employee?.first_name} {submission.employee?.last_name}
                      </button>
                      <div className="text-sm text-muted-foreground">
                        {submission.employee?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {submission.tasks?.title || "Unbekannt"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(submission.updated_at), "dd.MM.yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(submission.status, !!submission.admin_data?.demo_data_updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(submission.status === "assigned" || submission.status === "pending" || submission.status === "in_progress") && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleOpenSubmission(submission)}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          Demo-Daten
                        </Button>
                      )}
                      {submission.status !== "awaiting_review" &&
                       submission.status !== "in_review" &&
                       submission.status !== "approved" &&
                       submission.status !== "kyc_completed" &&
                       !submission.admin_data?.kyc_completed && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkKycCompleted(submission)}
                        >
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          KYC bestätigen
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      <DemoDataDialog
        submissionId={selectedSubmissionId}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onSaved={handleSaved}
      />

      <EmployeeDetailDialog
        employeeId={selectedEmployeeId}
        open={employeeDialogOpen}
        onOpenChange={setEmployeeDialogOpen}
      />
    </>
  );
};

export default AllTasksTab;
