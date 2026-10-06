import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, ArrowRight, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast-stub";

const TaskSubmitted = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubmissionStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      if (!taskId) {
        navigate("/dashboard/tasks");
        return;
      }

      // Prüfe den Status der Submission
      const { data: submission } = await supabase
        .from("task_submissions")
        .select("status, notes")
        .eq("task_id", taskId)
        .eq("employee_id", session.user.id)
        .maybeSingle();

      if (!submission) {
        toast.error("Keine Submission gefunden");
        navigate("/dashboard/tasks");
        return;
      }

      setSubmissionStatus(submission.status);
      setRejectionNotes(submission.notes);

      // Wenn Status "in_progress" ist (abgelehnt), zurück zur Bearbeitung
      if (submission.status === "in_progress" && submission.notes) {
        toast.error(`Aufgabe abgelehnt: ${submission.notes}`, { duration: 8000 });
        navigate(`/dashboard/tasks/${taskId}`);
        return;
      }

      // Nur "awaiting_review" oder "in_review" zeigen diese Seite
      if (submission.status !== "awaiting_review" && submission.status !== "in_review") {
        navigate("/dashboard/tasks");
        return;
      }

      setLoading(false);
    };

    checkSubmissionStatus();
  }, [navigate, taskId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Lade Status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-none shadow-xl">
          <CardHeader className="flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <CardTitle className="text-2xl">Zur Prüfung eingereicht</CardTitle>
            <CardDescription>
              Ihre Unterlagen wurden erfolgreich übermittelt und befinden sich nun in der Prüfung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <Button onClick={() => navigate("/dashboard/tasks")}>Zur Auftragsübersicht</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskSubmitted;
