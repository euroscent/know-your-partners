import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/ui/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/lib/toast-stub";
import euroscentLogoAsset from "@/assets/euroscent-logo.png.asset.json";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const features = [
    {
      title: "Echtzeit-KYC-Verifizierung",
      description: "Verifizieren Sie Identitäten in Sekunden mit unserer fortschrittlichen KYC-Technologie.",
    },
    {
      title: "Payment Provider Integration",
      description: "Nahtlose Integration mit über 50 führenden Payment Providern weltweit.",
    },
    {
      title: "Compliance-Automatisierung",
      description: "Bleiben Sie automatisch compliant mit globalen Regulierungen und Standards.",
    },
  ];

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/login");
      }
    });

    // Auto-rotate slides
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % features.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [navigate]);

  const validateForm = () => {
    if (!email || !password) {
      toast({
        title: "Fehler",
        description: "Bitte E-Mail und Passwort eingeben",
        variant: "destructive",
      });
      return false;
    }

    if (isSignUp && (!firstName || !lastName || !company)) {
      toast({
        title: "Fehler",
        description: "Bitte alle Pflichtfelder ausfüllen",
        variant: "destructive",
      });
      return false;
    }

    if (isSignUp && !acceptTerms) {
      toast({
        title: "Fehler",
        description: "Bitte akzeptieren Sie die Nutzungsbedingungen",
        variant: "destructive",
      });
      return false;
    }

    if (password.length < 6) {
      toast({
        title: "Fehler",
        description: "Passwort muss mindestens 6 Zeichen lang sein",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    // Simulate loading for demo purposes
    setTimeout(() => {
      if (isSignUp) {
        toast({
          title: "Registrierung eingegangen",
          description: "Ihre Registrierung wird geprüft, wir setzen uns bald mit Ihnen in Verbindung.",
        });
      } else {
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Bitte nutzen Sie /register für die Mitarbeiter-Registrierung.",
        });
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div>
            <img src={euroscentLogoAsset.url} alt="EuroScent Logo" className="h-10 w-10 object-contain mb-8" />
            <h1 className="text-4xl font-bold text-foreground mb-2">
              {isSignUp ? "Firmen-Registrierung" : "epp GmbH"}
            </h1>
            <p className="text-muted-foreground whitespace-pre-line">
              {isSignUp
                ? "Registrieren Sie Ihr Unternehmen für EPP"
                : ""}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Geschäftliche E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Passwort *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 6 Zeichen"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Passwort muss mindestens 6 Zeichen lang sein
                </p>
              )}
            </div>

            {isSignUp && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Firmenname *</Label>
                  <Input
                    id="company"
                    placeholder="Ihr Unternehmen"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  />
                  <Label
                    htmlFor="terms"
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    Durch die Registrierung bestätigen Sie, dass Sie unsere{" "}
                    <a href="/impressum" className="text-primary hover:underline">
                      Nutzungsbedingungen
                    </a>{" "}
                    und{" "}
                    <a href="/privacy" className="text-primary hover:underline">
                      Datenschutzerklärung
                    </a>{" "}
                    gelesen haben und diesen zustimmen
                  </Label>
                </div>
              </>
            )}

            <LoadingButton
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              loading={loading}
              loadingText="Wird geladen..."
            >
              {isSignUp ? "Kostenlos registrieren" : "Anmelden"}
            </LoadingButton>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-muted-foreground hover:text-foreground block w-full"
              >
                {isSignUp ? (
                  <>
                    Haben Sie bereits ein Konto?{" "}
                    <span className="text-primary font-semibold">Anmelden</span>
                  </>
                ) : (
                  <>
                    Noch kein Konto?{" "}
                    <span className="text-primary font-semibold">Registrieren</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Side - Features Carousel */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary to-primary/80 text-white p-16 items-center justify-center relative overflow-hidden">
        <div className="max-w-lg space-y-8 relative z-10">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold">{features[currentSlide].title}</h2>
            <p className="text-xl opacity-90">{features[currentSlide].description}</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() =>
                setCurrentSlide((prev) => (prev - 1 + features.length) % features.length)
              }
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex gap-2">
              {features.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide ? "w-8 bg-white" : "w-2 bg-white/50"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={() => setCurrentSlide((prev) => (prev + 1) % features.length)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Decorative background */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
      </div>
    </div>
  );
};

export default Auth;