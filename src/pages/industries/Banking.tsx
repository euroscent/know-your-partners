import { useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Shield, TrendingUp, Lock, AlertTriangle, CheckCircle2, Users, DollarSign, UserX, X } from "lucide-react";
import heroImage from "@/assets/banking-hero.png";
import sidebarImage1 from "@/assets/sidebar-image-1.png";
import sidebarImage2 from "@/assets/sidebar-image-2.png";
import sidebarImage3 from "@/assets/sidebar-image-3.png";
import sidebarImage4 from "@/assets/sidebar-image-4.png";
import useEmblaCarousel from "embla-carousel-react";

const Banking = () => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });

  const challenges = [
    {
      icon: DollarSign,
      title: "Synthetischer Identitätsbetrug",
      stat: "6 Mrd. €",
      description: "Betrüger nutzen echte Ausweisdokumente mit gefälschten Kontaktdaten, um KYC-Prüfungen zu umgehen."
    },
    {
      icon: AlertTriangle,
      title: "Anstieg bei Betrugsversuchen",
      stat: "10x",
      description: "KI-Tools ermöglichen Betrügern ausgefeilte Social-Engineering-Angriffe durch Phishing und Identitätsfälschung."
    },
    {
      icon: Shield,
      title: "Jährlich gewaschenes Geld",
      stat: "2 Bio. €",
      description: "Kriminelle nutzen gefälschte oder gestohlene Identitäten zur Geldwäsche und zum Betrieb illegaler Finanzströme."
    },
    {
      icon: UserX,
      title: "Durchschnittsverlust pro ATO",
      stat: "6-13k €",
      description: "Account-Takeover durch kompromittierte Zugangsdaten führt zu Diebstahl und betrügerischen Transaktionen."
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
    <div className="min-h-screen relative">
      <Navigation />
      
      {/* Floating Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-foreground">Kostenlose Testversion</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 mb-6">
            <img 
              src={sidebarImage1} 
              alt="KYC Feature 1" 
              className="w-full rounded-lg border border-border"
            />
            <img 
              src={sidebarImage2} 
              alt="KYC Feature 2" 
              className="w-full rounded-lg border border-border"
            />
            <img 
              src={sidebarImage3} 
              alt="KYC Feature 3" 
              className="w-full rounded-lg border border-border"
            />
            <img 
              src={sidebarImage4} 
              alt="KYC Feature 4" 
              className="w-full rounded-lg border border-border"
            />
          </div>
          
          <Button 
            variant="hero" 
            size="lg" 
            className="w-full"
            asChild
          >
            <a href="/auth">Kostenlos starten</a>
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-secondary text-secondary-foreground py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block">
                <span className="text-sm font-semibold tracking-wide uppercase opacity-90">
                  BANKWESEN
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                Sichere KYC-Lösungen für das moderne Bankwesen
              </h1>
              <p className="text-lg md:text-xl opacity-90">
                Schützen Sie Kundenakquise, Onboarding und Authentifizierung mit PayExpert's 
                professionellen KYC-Dienstleistungen und Payment Provider-Integrationen.
              </p>
            </div>
            <div className="relative">
              <img 
                src={heroImage}
                alt="Banking KYC Solutions"
                className="rounded-2xl shadow-[var(--shadow-medium)] border border-border"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Section with Carousel */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
                HERAUSFORDERUNGEN
              </p>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                Die wachsende Bedrohung durch Finanzbetrug
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Traditionelle AML- und KYC-Prüfungen reichen nicht mehr aus, um Banken vor 
                modernen, KI-gestützten Betrugsmethoden zu schützen. Ein neuer Ansatz ist erforderlich.
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
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              LÖSUNGEN
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Umfassender Schutz für alle Banking-Aktivitäten
            </h2>
            <p className="text-lg text-muted-foreground">
              Bewerten, genehmigen oder prüfen Sie neue Konten, Logins und Transaktionen 
              in Echtzeit ohne Beeinträchtigung der Benutzererfahrung.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Users className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Kunden-Onboarding
              </h3>
              <p className="text-muted-foreground mb-6">
                Verbessern Sie die Benutzerverifizierung während des Onboardings und 
                bestätigen Sie echte Anmeldungen in Sekunden.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Automatisierte ID-Verifizierung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Liveness-Checks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>AML-Screening</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Lock className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Login-Sicherheit
              </h3>
              <p className="text-muted-foreground mb-6">
                Verhindern Sie Kontoübernahmen mit mehrschichtigem ATO-Schutz und 
                Verhaltensanalyse.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Multi-Faktor-Authentifizierung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Geräte-Fingerprinting</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Risiko-basierte Authentifizierung</span>
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
              <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10 text-primary">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-2xl font-semibold text-card-foreground mb-4">
                Transaktions-Monitoring
              </h3>
              <p className="text-muted-foreground mb-6">
                Erkennen Sie verdächtige Transaktionsmuster in Echtzeit und verhindern 
                Sie Geldwäsche.
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Echtzeit-Transaktionsanalyse</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Verhaltensanomalien-Erkennung</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Regelbasierte Alerts</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              VORTEILE
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Warum PayExpert für Banken?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Höhere Conversion-Raten
                  </h3>
                  <p className="text-muted-foreground">
                    Reduzieren Sie Abbruchraten beim Onboarding durch schnelle, 
                    reibungslose Verifizierungsprozesse.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-8 border-border">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 rounded-lg bg-primary/10">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Regulatorische Compliance
                  </h3>
                  <p className="text-muted-foreground">
                    Erfüllen Sie alle AML-, KYC- und Datenschutz-Anforderungen 
                    automatisch und nachweisbar.
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
                    Betrugsreduzierung
                  </h3>
                  <p className="text-muted-foreground">
                    Minimieren Sie finanzielle Verluste durch frühzeitige Erkennung 
                    von Betrugsmustern und verdächtigen Aktivitäten.
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
                    Datensicherheit
                  </h3>
                  <p className="text-muted-foreground">
                    Höchste Sicherheitsstandards für sensible Kundendaten mit 
                    Ende-zu-Ende-Verschlüsselung.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Bereit für sichere Banking-Lösungen?
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground">
              Kontaktieren Sie uns für eine individuelle Beratung zu KYC-Lösungen 
              und Payment Provider-Integrationen für Ihr Bankunternehmen.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Banking;
