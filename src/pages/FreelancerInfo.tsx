import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Clock, 
  Euro, 
  Globe, 
  Laptop, 
  Shield, 
  TrendingUp,
  FileText,
  Users,
  Zap,
  ArrowRight,
  Home,
  Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const FreelancerInfo = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Home,
      title: "100% Remote",
      description: "Arbeiten Sie von überall – Hauptsache stabile Internetverbindung"
    },
    {
      icon: Clock,
      title: "Flexible Zeiten",
      description: "Sie entscheiden, wann Sie arbeiten. Morgens, abends, am Wochenende"
    },
    {
      icon: Euro,
      title: "Attraktive Vergütung",
      description: "Leistungsbasierte Bezahlung pro geprüftem Fall – je mehr Sie arbeiten, desto mehr verdienen Sie"
    },
    {
      icon: TrendingUp,
      title: "Wachstumspotenzial",
      description: "Steigern Sie Ihren Verdienst durch Erfahrung und höhere Fallzahlen"
    },
    {
      icon: Laptop,
      title: "Einfacher Einstieg",
      description: "Umfassende Einarbeitung – keine Vorkenntnisse im KYC-Bereich nötig"
    },
    {
      icon: Shield,
      title: "Sichere Aufträge",
      description: "Kontinuierliche Auftragslage durch namhafte Kunden aus der Finanzbranche"
    }
  ];

  const requirements = [
    {
      category: "Persönliche Voraussetzungen",
      items: [
        "Mindestalter 18 Jahre",
        "Wohnsitz in Deutschland, Österreich oder der Schweiz",
        "Sehr gute Deutschkenntnisse (mindestens C1)",
        "Sorgfältige und gewissenhafte Arbeitsweise",
        "Zuverlässigkeit und Termintreue"
      ]
    },
    {
      category: "Technische Anforderungen",
      items: [
        "Eigener PC/Laptop mit aktueller Software",
        "Stabile Internetverbindung (min. 10 Mbit/s)",
        "Ruhiger Arbeitsplatz ohne Störungen",
        "Webcam für gelegentliche Video-Calls"
      ]
    },
  ];

  const processSteps = [
    {
      step: 1,
      title: "Bewerbung",
      description: "Füllen Sie unser Online-Formular aus und laden Sie Ihren Lebenslauf hoch"
    },
    {
      step: 2,
      title: "Kennenlernen",
      description: "Kurzes Video-Interview zum gegenseitigen Kennenlernen"
    },
    {
      step: 3,
      title: "Schulung",
      description: "Umfassende Online-Einarbeitung in KYC-Prozesse und unsere Tools"
    },
    {
      step: 4,
      title: "Testphase",
      description: "Bearbeitung erster Fälle unter Anleitung"
    },
    {
      step: 5,
      title: "Freischaltung",
      description: "Nach bestandener Prüfung: Voller Zugang zu allen Aufträgen"
    }
  ];

  const compensationDetails = [
    {
      icon: FileText,
      title: "Pro-Fall-Vergütung",
      description: "Sie erhalten eine feste Vergütung pro erfolgreich geprüftem KYC-Fall. Je komplexer der Fall, desto höher die Vergütung."
    },
    {
      icon: Calendar,
      title: "Monatliche Abrechnung",
      description: "Sie stellen am Monatsende eine Rechnung. Auszahlung erfolgt innerhalb von 14 Tagen."
    },
    {
      icon: TrendingUp,
      title: "Leistungsboni",
      description: "Bei hoher Qualität und Geschwindigkeit sind zusätzliche Boni möglich."
    }
  ];

  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative z-10 py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="secondary" className="mb-6 text-sm px-4 py-2">
              <Zap className="h-4 w-4 mr-2 inline" />
              Freiberufliche Tätigkeit
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              Werden Sie Teil unseres{" "}
              <span className="text-primary">KYC-Experten-Netzwerks</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Arbeiten Sie flexibel von zu Hause und unterstützen Sie führende Banken, 
              Kryptobörsen und FinTechs bei der Identitätsprüfung ihrer Kunden.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => navigate("/careers/kyc-assistant")}
                className="text-lg px-8"
              >
                Jetzt bewerben
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById('requirements')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Anforderungen prüfen
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Ihre Vorteile als Freiberufler
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Genießen Sie maximale Flexibilität bei attraktiver Vergütung
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow border-border/50">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <benefit.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">{benefit.title}</h3>
                    <p className="text-muted-foreground text-sm">{benefit.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Compensation Section */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Transparente Vergütung
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Faire Bezahlung basierend auf Ihrer Leistung
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {compensationDetails.map((item, index) => (
              <Card key={index} className="p-8 text-center border-border/50">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <item.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </Card>
            ))}
          </div>
          
        </div>
      </section>

      {/* Requirements Section */}
      <section id="requirements" className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Anforderungen
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Diese Voraussetzungen sollten Sie erfüllen
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {requirements.map((req, index) => (
              <Card key={index} className="p-6 border-border/50">
                <h3 className="text-xl font-semibold text-foreground mb-6 pb-4 border-b border-border">
                  {req.category}
                </h3>
                <ul className="space-y-3">
                  {req.items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              So funktioniert der Einstieg
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              In 5 einfachen Schritten zum Freiberufler
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-primary/30 hidden md:block" />
              
              {processSteps.map((step, index) => (
                <div key={index} className="relative flex gap-6 mb-8 last:mb-0">
                  <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold z-10">
                    {step.step}
                  </div>
                  <Card className="flex-1 p-6 border-border/50">
                    <h3 className="text-xl font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="relative z-10 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Häufige Fragen
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="p-6 border-border/50">
              <h3 className="font-semibold text-foreground mb-2">
                Brauche ich KYC-Erfahrung?
              </h3>
              <p className="text-muted-foreground">
                Nein! Wir bieten eine umfassende Einarbeitung. Wichtiger sind Sorgfalt, 
                Zuverlässigkeit und gute Deutschkenntnisse.
              </p>
            </Card>
            
            <Card className="p-6 border-border/50">
              <h3 className="font-semibold text-foreground mb-2">
                Wie viele Stunden muss ich arbeiten?
              </h3>
              <p className="text-muted-foreground">
                Sie entscheiden selbst! Ob 5 oder 40 Stunden pro Woche – Sie sind völlig flexibel. 
                Wir empfehlen mindestens 10 Stunden pro Woche für einen kontinuierlichen Workflow.
              </p>
            </Card>
            
            
            
            <Card className="p-6 border-border/50">
              <h3 className="font-semibold text-foreground mb-2">
                Wann erhalte ich mein Geld?
              </h3>
              <p className="text-muted-foreground">
                Sie stellen am Monatsende eine Rechnung über alle bearbeiteten Fälle. 
                Die Auszahlung erfolgt innerhalb von 14 Tagen auf Ihr Konto.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 bg-primary/5">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Users className="h-16 w-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Bereit durchzustarten?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Werden Sie Teil unseres wachsenden Netzwerks von über 500 Freiberuflern 
              und starten Sie noch heute.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/careers/kyc-assistant")}
              className="text-lg px-10"
            >
              Jetzt bewerben
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default FreelancerInfo;
