import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Eye } from "lucide-react";
import { toast } from "@/lib/toast-stub";
import { format } from "date-fns";
import DemoDataDialog from "@/components/admin/DemoDataDialog";
import EmployeeDetailDialog from "@/components/admin/EmployeeDetailDialog";

interface DemoDataTabProps {
  onUpdate?: () => void;
}

interface Submission {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  submitted_at: string;
  admin_data: any;
  tasks: {
    id: string;
    title: string;
    steps: any[];
  } | null;
  employee?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

const DemoDataTab = ({ onUpdate }: DemoDataTabProps) => {
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
      .channel('demo-data-submissions')
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
    // Get admin IDs to exclude
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

    // Fetch pending submissions (waiting for demo data)
    const { data: submissionsData, error } = await supabase
      .from("task_submissions")
      .select(`
        *,
        tasks!inner (
          id,
          title,
          steps
        )
      `)
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Fehler beim Laden");
      setLoading(false);
      return;
    }

    // Filter out admin submissions
    const filteredSubmissions = (submissionsData as any[])?.filter(sub => 
      sub.tasks != null && !adminIds.has(sub.employee_id)
    ) || [];

    // Fetch employee profiles
    const employeeIds = [...new Set(filteredSubmissions.map(s => s.employee_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", employeeIds);

    const profilesMap = new Map(profiles?.map(p => [p.id, p]));

    // Enrich with employee data
    const enrichedSubmissions = filteredSubmissions.map(sub => ({
      ...sub,
      employee: profilesMap.get(sub.employee_id) || {
        first_name: "Unbekannt",
        last_name: "",
        email: ""
      }
    }));

    setSubmissions(enrichedSubmissions);
    setLoading(false);
  };

  const handleOpenSubmission = (submissionId: string) => {
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
          <Clock className="h-5 w-5" />
          Warten auf Demo-Daten
        </CardTitle>
        <CardDescription>
          Diese Aufträge warten auf die Ergänzung von Demo-Daten durch einen Admin
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Keine ausstehenden Demo-Daten</h3>
            <p className="text-muted-foreground">
              Alle Anfragen wurden bereits bearbeitet
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitarbeiter</TableHead>
                <TableHead>Aufgabe</TableHead>
                <TableHead>Angefragt am</TableHead>
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
                    {format(new Date(submission.submitted_at), "dd.MM.yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Ausstehend
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenSubmission(submission.id)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Bearbeiten
                    </Button>
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

export default DemoDataTab;
