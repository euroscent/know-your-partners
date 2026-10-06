import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast-stub";

interface TaskActionsBarProps {
  taskId: string;
  /** Optional callback (kept for backwards compat). */
  onReset?: () => void;
}

/**
 * "Jetzt komplett beenden":
 * Storniert den kompletten Fortschritt (step_responses, KYC-Flags, Demo-Flags),
 * setzt die Submission zurück auf "in_progress" ohne submitted_at — daher landet
 * der Auftrag NICHT bei "Zur Prüfung" und es wird KEINE Admin-Benachrichtigung
 * ausgelöst. Der Mitarbeiter wird zurück zur Auftrags-Liste navigiert.
 */
export function TaskActionsBar({ taskId }: TaskActionsBarProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kycCompleted, setKycCompleted] = useState(false);

  const openDialog = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;
      const { data } = await supabase
        .from("task_submissions")
        .select("admin_data")
        .eq("task_id", taskId)
        .eq("employee_id", userId)
        .maybeSingle();
      const ad = (data?.admin_data as any) || {};
      setKycCompleted(!!ad.kyc_completed);
    } catch {
      setKycCompleted(false);
    } finally {
      setOpen(true);
    }
  };

  const handleEnd = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Nicht angemeldet");

      const { data: existing } = await supabase
        .from("task_submissions")
        .select("id, admin_data")
        .eq("task_id", taskId)
        .eq("employee_id", userId)
        .maybeSingle();

      const adminData = { ...((existing?.admin_data as any) || {}) };
      [
        "current_step_index",
        "last_section",
        "restart_from_step",
        "rejection_timestamp",
        "kyc_completed",
        "postal_documents_completed",
        "postal_documents_completed_at",
        "quality_check_completed",
        "quality_check_completed_at",
      ].forEach((k) => delete adminData[k]);

      const payload: any = {
        task_id: taskId,
        employee_id: userId,
        status: "in_progress",
        step_responses: [],
        checklist_data: null,
        checklist_completed: false,
        admin_data: adminData,
        submitted_at: null,
        reviewed_at: null,
        reviewed_by: null,
        notes: null,
      };
      if (existing?.id) payload.id = existing.id;

      const { error } = await supabase
        .from("task_submissions")
        .upsert(payload, { onConflict: "id" });
      if (error) throw error;

      toast.success("Auftrag wurde beendet.");
      setOpen(false);
      navigate("/dashboard/tasks");
    } catch (err: any) {
      console.error("[TaskActionsBar] end error", err);
      toast.error(err?.message || "Auftrag konnte nicht beendet werden.");
    } finally {
      setLoading(false);
    }
  };

  const description = kycCompleted
    ? "Der aktuelle KYC-Fortschritt geht verloren, wenn Sie den Vorgang jetzt beenden."
    : "Der Auftrag wird sofort beendet. Die weitere Bearbeitung ist danach nicht mehr möglich.";

  return (
    <>
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Sie können den Auftrag jetzt komplett beenden. Der gesamte Fortschritt wird storniert.
            </div>
            <div className="flex shrink-0">
              <Button size="sm" onClick={openDialog} disabled={loading}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Jetzt komplett beenden
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auftrag komplett beenden?</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Wird beendet…
                </>
              ) : (
                "Ja, jetzt beenden"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
