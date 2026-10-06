import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/lib/toast-stub";
import euroscentLogoAsset from "@/assets/euroscent-logo.png";
import { Eye, EyeOff } from "lucide-react";

const PUBLISHED_LOGIN_URL = "https://trust-gateway-lab.lovable.app/login";

const isPreviewAuthContext = () => {
  const host = window.location.hostname;
  const isIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  return isIframe || host.endsWith(".lovableproject.com") || host.startsWith("id-preview--");
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const previewAuthBlocked = isPreviewAuthContext();

  const redirectParam = searchParams.get("redirect");
  let storedRedirect: string | null = null;
  try {
    storedRedirect = sessionStorage.getItem("postLoginRedirect");
  } catch {
    storedRedirect = null;
  }

  const rawRedirect = redirectParam || storedRedirect;
  // Only allow internal redirects to avoid malformed URLs and open-redirect issues
  const redirectTarget = rawRedirect && rawRedirect.startsWith("/") ? rawRedirect : "/dashboard";

  console.debug("[Login] redirectParam=", redirectParam, "stored=", storedRedirect, "-> target=", redirectTarget);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        try {
          sessionStorage.removeItem("postLoginRedirect");
        } catch {
          // ignore
        }
        navigate(redirectTarget, { replace: true });
      }
    }).catch((err) => {
      console.error("[Login] getSession error:", err);
    });
  }, [navigate, redirectTarget]);

  const validateForm = () => {
    if (!email || !password) {
      toast({
        title: "Fehler",
        description: "Bitte E-Mail und Passwort eingeben",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      let loginEmail = email.trim();
      if (!loginEmail.includes("@")) {
        const { data: resolved } = await (supabase as any).rpc("get_login_email", { _username: loginEmail });
        if (!resolved) throw new Error("Invalid login credentials");
        loginEmail = resolved as string;
      }
      const loginResult = await Promise.race([
        supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        }),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("AUTH_PREVIEW_TIMEOUT")),
            previewAuthBlocked ? 8000 : 15000,
          ),
        ),
      ]);

      const { error } = loginResult;

      if (error) throw error;

      // Ensure session is available before navigating to a protected route
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        await new Promise((r) => setTimeout(r, 300));
      }

      toast({
        title: "Login erfolgreich!",
        description: "Willkommen zurück!",
      });

      try {
        sessionStorage.removeItem("postLoginRedirect");
      } catch {
        // ignore
      }
      navigate(redirectTarget, { replace: true });
    } catch (error: any) {
      console.error("[Login] signIn error:", error);
      let description = "Ungültige E-Mail oder Passwort";
      if (error.message?.includes("Invalid login credentials")) {
        description = "E-Mail oder Passwort ist falsch. Bitte überprüfen Sie Ihre Eingaben.";
      } else if (error.message?.includes("Email not confirmed")) {
        description = "E-Mail wurde noch nicht bestätigt. Bitte prüfen Sie Ihren Posteingang.";
      } else if (error.message === "AUTH_PREVIEW_TIMEOUT" || error.message?.includes("Failed to fetch")) {
        description = previewAuthBlocked
          ? "Die Preview blockiert aktuell den Auth-Request. Bitte öffnen Sie den Login in einem neuen Tab oder nutzen Sie die veröffentlichte App."
          : "Die Verbindung zum Login-Dienst wurde unterbrochen. Bitte erneut versuchen.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Login fehlgeschlagen",
        description,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast({
        title: "E-Mail fehlt",
        description: "Bitte geben Sie zuerst Ihre E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: "E-Mail gesendet",
        description: "Falls ein Konto existiert, erhalten Sie einen Link zum Zurücksetzen Ihres Passworts.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bitte versuchen Sie es später erneut.";
      toast({
        title: "E-Mail konnte nicht gesendet werden",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 euroscent-login-bg">
      <div className="w-full max-w-md relative z-10">
        <div className="bg-card/80 backdrop-blur-md p-8 rounded-lg shadow-2xl border border-border/60">
          <div className="mb-8 text-center">
            <div className="flex flex-col items-center">
              <img
                src={euroscentLogoAsset}
                alt="EuroScent Logo"
                className="h-24 w-24 rounded-full object-cover shadow-lg ring-1 ring-border"
              />
              <span className="font-serif text-3xl font-bold tracking-tight text-foreground mt-4">EuroScent</span>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground mt-1">
                Mitarbeiter-Portal
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">Passwort</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {resetLoading ? "Wird gesendet…" : "Passwort vergessen?"}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <LoadingButton
              type="submit"
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
              loading={loading}
              loadingText="Wird angemeldet..."
            >
              Anmelden
            </LoadingButton>

            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Noch kein Konto?{" "}
                <a
                  href="/register"
                  className="text-primary hover:underline font-semibold"
                >
                  Hier registrieren
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
