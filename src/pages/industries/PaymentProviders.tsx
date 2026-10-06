import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, CheckCircle2, TrendingUp, AlertTriangle, Users, Lock, Zap, FileCheck } from "lucide-react";

const PaymentProviders = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative z-10 py-20 md:py-32 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold text-primary tracking-wide uppercase">
                Payment Providers
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
                Sichere Zahlungsabwicklung durch intelligente KYC-Prüfung
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground">
                Verifizieren Sie Händler, schützen Sie Konten und sichern Sie Transaktionen mit Echtzeit-Analyse und automatisierten Prüfprozessen.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button variant="hero" size="lg" asChild>
                  <a href="/auth">Kostenlos starten</a>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="/contact">Demo vereinbaren</a>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-border shadow-[var(--shadow-medium)]">
                <Shield className="h-32 w-32 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fraud Challenges Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Erkennen Sie betrügerische Händler frühzeitig
            </h2>
            <p className="text-lg text-muted-foreground">
              Traditionelle KYB-Prüfungen reichen nicht aus, um moderne Betrugsversuche zu erkennen. Zeit für einen intelligenteren Ansatz zur Händler-Risikobewertung.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Identitätsbetrug bei Händlern
              </h3>
              <p className="text-muted-foreground mb-4">
                Kriminelle geben sich zunehmend als legitime Unternehmen aus, um Zahlungssysteme auszunutzen und betrügerische Transaktionen zu verarbeiten.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-2xl font-bold text-primary mb-1">8-12%</p>
                <p className="text-sm text-muted-foreground">
                  Händler mit gefälschten Identitäten
                </p>
              </div>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-destructive/10 text-destructive">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Kontoübernahmen
              </h3>
              <p className="text-muted-foreground mb-4">
                Betrüger nutzen Datenlecks und Phishing-Angriffe, um Zugang zu Händlerkonten zu erhalten und Guthaben abzuheben.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-2xl font-bold text-primary mb-1">€11 Mrd.</p>
                <p className="text-sm text-muted-foreground">
                  Jährliche Verluste durch Kontoübernahmen
                </p>
              </div>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-destructive/10 text-destructive">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Transaction Laundering
              </h3>
              <p className="text-muted-foreground mb-4">
                Kriminelle nutzen legitime Händlerzugänge, um heimlich Kartenzahlungen für illegale Waren und Dienstleistungen abzuwickeln.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-2xl font-bold text-primary mb-1">€180 Mrd.</p>
                <p className="text-sm text-muted-foreground">
                  Geschätzter jährlicher Schaden in Europa
                </p>
              </div>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-destructive/10 text-destructive">
                <FileCheck className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                MCC-Code Missbrauch
              </h3>
              <p className="text-muted-foreground mb-4">
                Händler klassifizieren ihr Geschäft bewusst falsch, um Transaktionsgebühren zu reduzieren oder Betrugserkennungssysteme zu umgehen.
              </p>
              <div className="pt-4 border-t border-border">
                <p className="text-2xl font-bold text-primary mb-1">15-20%</p>
                <p className="text-sm text-muted-foreground">
                  Fälle von MCC-Missklassifizierung
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              Unsere Lösungen
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Schützen Sie alle Zahlungsaktivitäten in Echtzeit
            </h2>
            <p className="text-lg text-muted-foreground">
              Unsere KYC-Lösungen bieten umfassenden Schutz für Payment Provider und ihre Händler
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="p-8 border-border bg-card">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 text-primary">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Automatisiertes Onboarding
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Identitätsprüfung in Sekunden</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Dokumentenverifikation mit KI</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Compliance-Check automatisiert</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border bg-card">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 text-primary">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Kontinuierliches Monitoring
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">24/7 Transaktionsüberwachung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Anomalie-Erkennung in Echtzeit</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Automatische Risikobewertung</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border bg-card">
              <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                Intelligente Analysen
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Predictive Fraud Detection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Verhaltensanalyse-Modelle</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Detaillierte Reporting-Dashboards</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Vorteile für Payment Provider
              </h2>
              <p className="text-lg text-muted-foreground">
                Reduzieren Sie Betrug, steigern Sie die Compliance und beschleunigen Sie das Händler-Onboarding
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Bis zu 70% weniger Betrug
                  </h3>
                  <p className="text-muted-foreground">
                    Durch fortschrittliche KI-gestützte Betrugserkennung und kontinuierliches Monitoring
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    80% schnelleres Onboarding
                  </h3>
                  <p className="text-muted-foreground">
                    Automatisierte Verifizierungsprozesse verkürzen die Time-to-Market erheblich
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    100% Regulatory Compliance
                  </h3>
                  <p className="text-muted-foreground">
                    Erfüllung aller relevanten Vorschriften inkl. PSD2, AMLD5 und lokaler Anforderungen
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Verbesserte Händler-Experience
                  </h3>
                  <p className="text-muted-foreground">
                    Reibungsloser Verifizierungsprozess führt zu höherer Händlerzufriedenheit
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 md:py-32 bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Bereit für sicherere Zahlungsabwicklung?
            </h2>
            <p className="text-lg text-muted-foreground">
              Erfahren Sie, wie PayExpert Ihre Händler-Verifizierung automatisiert und Betrug in Echtzeit verhindert.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button variant="hero" size="lg" asChild>
                <a href="/contact">Demo vereinbaren</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="/services">Mehr erfahren</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PaymentProviders;
