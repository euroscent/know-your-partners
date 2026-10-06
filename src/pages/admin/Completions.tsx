import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import CompletionsTab from "./request-center/CompletionsTab";

const Completions = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const isAdmin = roles?.some((r) => r.role === "admin") || false;
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Lädt Auftragsabschlüsse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Taskmails</h1>
        <p className="text-muted-foreground">
          Verwalten Sie E-Mail-Templates und versenden Sie Mails an Mitarbeiter
        </p>
      </div>

      <CompletionsTab onUpdate={() => {}} showTemplates={true} />
    </div>
  );
};

export default Completions;
