import { useState, useCallback, useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, TrendingUp, Lock, AlertTriangle, CheckCircle2, Users, Coins, DollarSign, UserX, UserCheck, Fish } from "lucide-react";
import heroImage from "@/assets/crypto-coins.png";
import useEmblaCarousel from "embla-carousel-react";

const fraudStats = [
  {
    id: "geldwasche",
    title: "Geldwäsche",
    icon: DollarSign,
    stat: "22,2",
    unit: "Milliarden US-Dollar",
    description: "Betrag, der im Jahr 2023 über Krypto-Netzwerke gewaschen wurde",
    details: "Kriminelle nutzen Sicherheitslücken und schnelle Onboarding-Prozesse auf Krypto-Plattformen, um Muling-Konten zu erstellen und illegale Gelder grenzüberschreitend zu verschieben."
  },
  {
    id: "kontoubernahme",
    title: "Kontoübernahme",
    icon: Lock,
    stat: "494",
    unit: "Millionen US-Dollar",
    description: "Wert der Vermögenswerte, die im Jahr 2024 aus Krypto-Wallets abgezogen werden",
    details: "Nachdem sie Benutzer dazu verleitet haben, bösartige Transaktionen zu signieren, erhalten Angreifer vollen Zugriff auf deren Krypto-Wallets und leeren sofort alle Vermögenswerte."
  },
  {
    id: "synthetisch",
    title: "Betrug mit synthetischen Identitäten",
    icon: UserX,
    stat: "23",
    unit: "Milliarden US-Dollar",
    description: "Verluste durch Betrug mit synthetischen Identitäten bis 2030",
    details: "Krypto-Plattformen werden zunehmend von Betrügern ins Visier genommen, die synthetische Identitäten erstellen, um KYC- und AML-Kontrollen zu umgehen und Geld grenzüberschreitend zu waschen."
  },
  {
    id: "social",
    title: "Soziales Ingenieurwesen",
    icon: Fish,
    stat: "5,6",
    unit: "Milliarden US-Dollar",
    description: "Kryptowährungsbetrag, der jährlich durch Betrug verloren geht",
    details: "Hacker verwenden zunehmend gestohlene Anmeldeinformationen, Phishing und Social Engineering, um auf bestehende Krypto-Konten zuzugreifen und Gelder zu stehlen."
  }
];

const Crypto = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback((index: number) => {
    emblaApi?.scrollTo(index);
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="text-sm font-semibold tracking-wide uppercase opacity-90">
                  KRYPTOWÄHRUNGEN
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                KYC-Compliance für Krypto-Plattformen
              </h1>
              <p className="text-lg md:text-xl opacity-90">
                Erfüllen Sie regulatorische Anforderungen und schützen Sie Ihre Krypto-Börse 
                mit professionellen KYC-Lösungen und Payment Provider-Integrationen von EuroScent.
              </p>
            </div>
            <div className="relative">
              <img 
                src={heroImage}
                alt="Crypto KYC Solutions"
                className="rounded-2xl shadow-[var(--shadow-medium)] border border-border animate-pulse hover:scale-105 transition-transform duration-500"
                style={{
                  animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite, glow 3s ease-in-out infinite'
                }}
              />
              <style>{`
                @keyframes glow {
                  0%, 100% {
                    filter: drop-shadow(0 0 10px rgba(247, 147, 26, 0.3));
                  }
                  50% {
                    filter: drop-shadow(0 0 30px rgba(247, 147, 26, 0.8)) drop-shadow(0 0 50px rgba(247, 147, 26, 0.5));
                  }
                }
              `}</style>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Section with Swipeable Carousel */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              HERAUSFORDERUNGEN
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Betrug im Krypto-Sektor
            </h2>
            <p className="text-lg text-muted-foreground">
              Krypto-Plattformen sind besonders anfällig für Betrug und müssen strikte 
              Regulierungsvorschriften erfüllen. KYC-Compliance ist unerlässlich.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {fraudStats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <button
                  key={stat.id}
                  onClick={() => scrollTo(index)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all ${
                    selectedIndex === index
                      ? "bg-primary/10 text-primary font-semibold"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm">{stat.title}</span>
                </button>
              );
            })}
          </div>

          {/* Carousel */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex touch-pan-y">
              {fraudStats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.id} className="flex-[0_0_100%] min-w-0 px-4">
                    <Card className="p-12 md:p-16 text-center border-border shadow-[var(--shadow-medium)] mx-auto max-w-3xl">
                      <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                      <div className="text-6xl md:text-7xl font-bold text-primary mb-2">
                        {stat.stat}
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-primary mb-6">
                        {stat.unit}
                      </div>
                      <p className="text-xl font-semibold text-foreground mb-6">
                        {stat.description}
                      </p>
                      <p className="text-muted-foreground leading-relaxed">
                        {stat.details}
                      </p>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-8">
            {fraudStats.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollTo(index)}
                className={`h-2 rounded-full transition-all ${
                  selectedIndex === index
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              LÖSUNGEN
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Compliance-Lösungen für Krypto-Börsen
            </h2>
            <p className="text-lg text-muted-foreground">
              Erfüllen Sie regulatorische Anforderungen und schützen Sie Ihre Plattform 
              mit automatisierten KYC- und AML-Lösungen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Benutzer-Verifizierung
              </h3>
              <p className="text-muted-foreground mb-6">
                Automatisierte ID-Verifizierung und Liveness-Checks für schnelles, 
                sicheres Onboarding Ihrer Krypto-Trader.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Dokument-Verifizierung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Biometrische Prüfung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Adressverifizierung</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                AML-Screening
              </h3>
              <p className="text-muted-foreground mb-6">
                Kontinuierliches Monitoring gegen Sanktionslisten, PEP-Listen und 
                bekannte Betrugsmuster.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Sanktionslisten-Prüfung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>PEP-Screening</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Adverse Media Check</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Coins className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Transaktions-Monitoring
              </h3>
              <p className="text-muted-foreground mb-6">
                Erkennen Sie verdächtige Krypto-Transaktionen und Wallet-Aktivitäten 
                in Echtzeit.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Blockchain-Analyse</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Risk-Scoring</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Travel Rule Compliance</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              REGULIERUNG
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              MiCA-Konformität für EU-Märkte
            </h2>
            <p className="text-lg text-muted-foreground">
              Die EU Markets in Crypto-Assets (MiCA) Verordnung fordert strenge KYC/AML-Compliance. 
              EuroScent hilft Ihnen, alle Anforderungen zu erfüllen.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Lizenzierung & Registrierung
                  </h3>
                  <p className="text-muted-foreground">
                    Unterstützung bei der Erfüllung aller KYC/AML-Anforderungen für 
                    MiCA-Lizenzierung und BaFin-Registrierung.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Kontinuierliches Monitoring
                  </h3>
                  <p className="text-muted-foreground">
                    Automatische Überwachung und Aktualisierung von Kundendaten 
                    gemäß regulatorischen Vorgaben.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Datenschutz (DSGVO)
                  </h3>
                  <p className="text-muted-foreground">
                    Vollständige DSGVO-Konformität bei der Verarbeitung und 
                    Speicherung sensibler Kundendaten.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Betrugsprävention
                  </h3>
                  <p className="text-muted-foreground">
                    Fortgeschrittene Erkennung von Betrugsmustern, synthetischen 
                    Identitäten und verdächtigen Aktivitäten.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              VORTEILE
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Warum EuroScent für Krypto-Plattformen?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mx-auto mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Regulierungs-Compliance
              </h3>
              <p className="text-muted-foreground">
                Erfüllen Sie MiCA, BaFin und alle internationalen 
                KYC/AML-Vorschriften automatisch.
              </p>
            </Card>

            <Card className="p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mx-auto mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Schnelles Onboarding
              </h3>
              <p className="text-muted-foreground">
                Verifizieren Sie neue Nutzer in Minuten, nicht Tagen – 
                ohne Kompromisse bei der Sicherheit.
              </p>
            </Card>

            <Card className="p-8 text-center border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mx-auto mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Betrugsprävention
              </h3>
              <p className="text-muted-foreground">
                Schützen Sie Ihre Plattform vor Scams, Geldwäsche 
                und betrügerischen Aktivitäten.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Bereit für MiCA-Compliance?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Kontaktieren Sie uns für eine individuelle Beratung zu KYC-Lösungen 
              und regulatorischer Compliance für Ihre Krypto-Plattform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button variant="hero" size="lg" className="text-base" asChild>
                <a href="/contact">Jetzt Beratung anfragen</a>
              </Button>
              <Button variant="outline" size="lg" className="text-base" asChild>
                <a href="/auth">Kostenlos starten</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Crypto;
