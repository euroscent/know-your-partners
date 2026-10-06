import { useEffect, useState } from "react";
import { PageLoader } from "@/components/PageLoader";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye } from "lucide-react";
import { toast } from "@/lib/toast-stub";

interface SubmissionWithDetails {
  id: string;
  task_id: string;
  employee_id: string;
  status: string;
  created_at: string;
  submitted_at: string;
  task_title: string;
  employee_name: string;
  employee_email: string;
}

const SubmissionsList = () => {
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchSubmissions();
  }, []);

  const checkAuthAndFetchSubmissions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!roles || roles.role !== "admin") {
      toast.error("Keine Berechtigung");
      navigate("/dashboard");
      return;
    }

    // Fetch submissions with statuses relevant for admins
    const { data: submissionsData, error } = await supabase
      .from("task_submissions")
      .select(`
        id,
        task_id,
        employee_id,
        status,
        created_at,
        submitted_at,
        tasks (
          title
        ),
        profiles (
          first_name,
          last_name,
          email
        )
      `)
      .in("status", ["in_review", "awaiting_review", "pending"]) // pending = Demo-Daten angefordert
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      toast.error("Fehler beim Laden der Einreichungen");
      setLoading(false);
      return;
    }

    const formatted = submissionsData.map((sub: any) => ({
      id: sub.id,
      task_id: sub.task_id,
      employee_id: sub.employee_id,
      status: sub.status,
      created_at: sub.created_at,
      submitted_at: sub.submitted_at,
      task_title: sub.tasks?.title || "Unbekannt",
      employee_name: `${sub.profiles?.first_name || ''} ${sub.profiles?.last_name || ''}`.trim(),
      employee_email: sub.profiles?.email || '',
    }));

    setSubmissions(formatted);
    setLoading(false);
  };

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

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/tasks")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Verwaltung
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">Eingereichte Aufträge zur Prüfung</CardTitle>
            <CardDescription>
              Übersicht aller Aufträge, die zur Prüfung eingereicht wurden
            </CardDescription>
          </CardHeader>
        </Card>

        {submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Keine Einreichungen zur Prüfung</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{submission.task_title}</h3>
                        {getStatusBadge(submission.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Mitarbeiter: {submission.employee_name} ({submission.employee_email})</p>
                        <p>
                          Eingereicht: {new Date(submission.submitted_at || submission.created_at).toLocaleString('de-DE')}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(`/admin/submissions/${submission.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Prüfen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionsList;
