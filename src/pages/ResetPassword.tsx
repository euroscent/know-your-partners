import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/toast-stub";
import eppLogoAsset from "@/assets/epp-logo.png.asset.json";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isRecoveryLink = hashParams.get("type") === "recovery";

    const checkRecoverySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      setValidRecovery(isRecoveryLink && Boolean(session));
      setCheckingLink(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event !== "PASSWORD_RECOVERY") return;
      setValidRecovery(Boolean(session));
      setCheckingLink(false);
    });

    window.setTimeout(checkRecoverySession, 250);

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast({
        title: "Passwort zu kurz",
        description: "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirmPassword) {
      toast({
        title: "Passwörter stimmen nicht überein",
        description: "Bitte geben Sie das neue Passwort erneut ein.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      toast({
        title: "Passwort konnte nicht geändert werden",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Passwort geändert", description: "Sie können sich jetzt mit dem neuen Passwort anmelden." });
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <section className="w-full max-w-md border bg-card p-8 shadow-lg rounded-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={eppLogoAsset.url} alt="EPP Logo" className="h-12 w-12 object-contain" />
          <h1 className="mt-5 text-3xl font-bold text-foreground">Neues Passwort</h1>
          <p className="mt-2 text-sm text-muted-foreground">Legen Sie ein neues Passwort für Ihr Mitarbeiterkonto fest.</p>
        </div>

        {checkingLink ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Wiederherstellungslink wird geprüft…</div>
        ) : validRecovery ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Passwort bestätigen</Label>
              <Input
                id="confirm-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <LoadingButton type="submit" className="w-full" size="lg" loading={saving} loadingText="Wird gespeichert…">
              Passwort speichern
            </LoadingButton>
          </form>
        ) : (
          <div className="space-y-5 text-center">
            <KeyRound className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Dieser Link ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen Link an.</p>
            <Button className="w-full" onClick={() => navigate("/login")}>Zur Anmeldung</Button>
          </div>
        )}
      </section>
    </main>
  );
};

export default ResetPassword;