import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import CTA from "@/components/CTA";
import { Button } from "@/components/ui/button";
import { Shield, UserCheck, Wallet, TrendingUp, CheckCircle, Users, FileCheck, AlertTriangle } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";

const MarketplacesPage = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const challenges = [
    {
      icon: AlertTriangle,
      title: "Betrug durch Fake-Verkäufer",
      stat: "40%",
      description: "der Online-Marktplätze berichten von betrügerischen Verkäufern, die gefälschte oder nicht existierende Produkte anbieten."
    },
    {
      icon: Users,
      title: "Vertrauensverlust",
      stat: "65%",
      description: "der Käufer verlassen Marktplätze nach negativen Erfahrungen mit nicht verifizierten Verkäufern dauerhaft."
    },
    {
      icon: Wallet,
      title: "Zahlungsbetrug",
      stat: "€2,4 Mrd",
      description: "Verluste durch betrügerische Transaktionen auf europäischen Marktplätzen im Jahr 2023."
    },
    {
      icon: FileCheck,
      title: "Manuelle Überprüfung",
      stat: "72h",
      description: "durchschnittliche Wartezeit für manuelle Verkäuferverifizierung kostet Marktplätze wertvolle Konversionen."
    }
  ];

  const handleTabChange = (index: number) => {
    setSelectedTab(index);
    emblaApi?.scrollTo(index);
  };

  const handleDotClick = (index: number) => {
    setSelectedTab(index);
    emblaApi?.scrollTo(index);
  };

  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
              <Users className="w-4 h-4" />
              Marktplätze & E-Commerce
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground">
              Vertrauenswürdige Marktplätze durch automatisierte KYC
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Schützen Sie Ihre Plattform vor Betrug und schaffen Sie Vertrauen zwischen Käufern und Verkäufern durch nahtlose Identitätsverifizierung.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button variant="hero" size="lg" asChild>
                <a href="/contact">Demo vereinbaren</a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="/services">Lösungen ansehen</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Section with Carousel */}
      <section className="relative z-10 py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Herausforderungen für Online-Marktplätze
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Ohne effektive Identitätsverifizierung sind Marktplätze anfällig für Betrug und Vertrauensverlust.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {challenges.map((challenge, index) => (
                <button
                  key={index}
                  onClick={() => handleTabChange(index)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedTab === index
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {challenge.title}
                </button>
              ))}
            </div>

            {/* Carousel */}
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex">
                {challenges.map((challenge, index) => {
                  const Icon = challenge.icon;
                  return (
                    <div key={index} className="flex-[0_0_100%] min-w-0 px-4">
                      <div className="bg-card border border-border rounded-xl p-8 md:p-12">
                        <div className="flex flex-col items-center text-center space-y-6">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <Icon className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <div className="text-5xl md:text-6xl font-bold text-primary mb-2">
                              {challenge.stat}
                            </div>
                            <h3 className="text-2xl font-bold text-foreground mb-4">
                              {challenge.title}
                            </h3>
                            <p className="text-lg text-muted-foreground max-w-2xl">
                              {challenge.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dot Navigation */}
            <div className="flex justify-center gap-2 mt-8">
              {challenges.map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleDotClick(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    selectedTab === index
                      ? "bg-primary w-8"
                      : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section className="relative z-10 py-20 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                KYC-Lösungen für Marktplätze
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Automatisierte Verifizierung schafft Vertrauen und reduziert Betrug auf Ihrer Plattform.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                  <UserCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Verkäufer-Verifizierung
                </h3>
                <p className="text-muted-foreground mb-6">
                  Automatische Überprüfung von Verkäufer-Identitäten in Echtzeit. Reduzieren Sie Fake-Accounts und schaffen Sie Vertrauen bei Ihren Käufern.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Ausweisverifizierung mit Liveness-Check</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Adressverifizierung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Automatisches Onboarding in unter 2 Minuten</span>
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Betrugsprävention
                </h3>
                <p className="text-muted-foreground mb-6">
                  KI-gestützte Risikoanalyse erkennt verdächtige Aktivitäten und schützt Ihre Plattform vor Betrug und Geldwäsche.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Echtzeit-Transaktionsüberwachung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">PEP und Sanctions Screening</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Verhaltensanalyse und Anomalie-Erkennung</span>
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Zahlungsverifizierung
                </h3>
                <p className="text-muted-foreground mb-6">
                  Sichere Zahlungsabwicklung durch Verifizierung von Zahlungsmethoden und Konten, um Chargebacks zu reduzieren.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Bankkonten-Verifizierung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Kreditkarten-Validierung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">3D Secure Integration</span>
                  </li>
                </ul>
              </div>

              <div className="bg-card border border-border rounded-xl p-8 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-6">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">
                  Compliance & Reporting
                </h3>
                <p className="text-muted-foreground mb-6">
                  Erfüllen Sie regulatorische Anforderungen automatisch und erstellen Sie Audit-sichere Reports für Behörden.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">GDPR-konforme Datenspeicherung</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Automatische Compliance-Reports</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Audit-Trail für alle Transaktionen</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Vorteile für Ihren Marktplatz
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Steigern Sie Vertrauen, Umsatz und Sicherheit durch professionelle KYC-Integration.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <TrendingUp className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">+45% Konversion</h3>
                <p className="text-muted-foreground">
                  Schnelleres Seller-Onboarding erhöht die Anzahl aktiver Verkäufer auf Ihrer Plattform.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">-80% Betrug</h3>
                <p className="text-muted-foreground">
                  Automatische Identitätsverifizierung reduziert betrügerische Aktivitäten drastisch.
                </p>
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground">+60% Vertrauen</h3>
                <p className="text-muted-foreground">
                  Käufer vertrauen Marktplätzen mit verifizierten Verkäufern deutlich mehr.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CTA />
      <Footer />
    </div>
  );
};

export default MarketplacesPage;