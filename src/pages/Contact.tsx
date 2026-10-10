import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const Contact = () => {
  const [contactInfo, setContactInfo] = useState({
    main_email: "office@euroscent.de",
    street_address: "Königsallee 89",
    postal_code: "40212",
    city: "Düsseldorf"
  });

  useEffect(() => {
    fetchContactInfo();
  }, []);

  const fetchContactInfo = async () => {
    const { data } = await supabase
      .from("company_contact")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (data) {
      setContactInfo({
        main_email: data.main_email || "office@euroscent.de",
        street_address: data.street_address || "Königsallee 89",
        postal_code: data.postal_code || "40212",
        city: data.city || "Düsseldorf"
      });
    }
  };
  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="bg-secondary text-secondary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Kontaktieren Sie uns
            </h1>
            <p className="text-lg opacity-90">
              Erfahren Sie, wie Sie KYC-Lösungen optimal nutzen und Ihre Compliance-Prozesse verbessern können.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="relative z-10 py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Left Column - Info */}
            <div className="space-y-8">
              <div>
                <p className="text-lg text-foreground leading-relaxed mb-6">
                  EuroScent ist eine führende Plattform für KYC-Verifizierung und Payment Provider-Integration, 
                  die sofortigen Zugang zu umfassenden Verifizierungslösungen bietet.
                </p>
                <p className="text-lg text-foreground leading-relaxed mb-6">
                  Möchten Sie mehr über unsere Produkte und Lösungen erfahren? Schreiben Sie uns oder 
                  vereinbaren Sie einen Termin, um zu besprechen, wie wir Ihnen helfen können:
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Schnelleres Onboarding</h3>
                    <p className="text-muted-foreground">
                      Optimieren Sie den digitalen Onboarding-Prozess mit Echtzeit-Verifizierung 
                      und datengestützter Kontoeröffnung.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Bessere Entscheidungen</h3>
                    <p className="text-muted-foreground">
                      Nutzen Sie umfassende Daten für verbesserte Genauigkeit Ihrer Geschäftsentscheidungen 
                      und höhere Genehmigungsraten.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Verbesserte Sicherheit</h3>
                    <p className="text-muted-foreground">
                      Bleiben Sie compliant und sicher durch Prävention von Betrug, synthetischen Identitäten 
                      und Account-Takeovers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/30 p-6 rounded-lg space-y-3">
                <h3 className="font-semibold text-foreground">Kontaktinformationen</h3>
                <div className="space-y-2 text-muted-foreground">
                  <p><strong>EuroScent GmbH</strong></p>
                  <p>{contactInfo.street_address}</p>
                  <p>{contactInfo.postal_code} {contactInfo.city}</p>
                  <p className="pt-2">E-Mail: {contactInfo.main_email}</p>
                </div>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-[var(--shadow-soft)]">
              <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Vorname *</Label>
                    <Input 
                      id="firstName" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Nachname *</Label>
                    <Input 
                      id="lastName" 
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Geschäftliche E-Mail *</Label>
                  <Input 
                    id="email" 
                    type="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefonnummer *</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="useCase">Anwendungsfall</Label>
                  <Select>
                    <SelectTrigger id="useCase">
                      <SelectValue placeholder="Bitte wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kyc">KYC-Verifizierung</SelectItem>
                      <SelectItem value="payment">Payment Provider Integration</SelectItem>
                      <SelectItem value="compliance">Compliance-Lösung</SelectItem>
                      <SelectItem value="partnership">Partnerschaft</SelectItem>
                      <SelectItem value="other">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Grund der Kontaktaufnahme</Label>
                  <Textarea 
                    id="message"
                    rows={5}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox id="privacy" />
                  <Label 
                    htmlFor="privacy" 
                    className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                  >
                    Ich möchte Informationen von EuroScent erhalten. Wir behandeln Ihre Daten vertraulich - 
                    siehe unsere <a href="/privacy" className="text-primary hover:underline">Datenschutzerklärung</a>.
                  </Label>
                </div>

                <Button type="submit" variant="hero" size="lg" className="w-full">
                  Nachricht senden
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
