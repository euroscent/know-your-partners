import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, DollarSign, MapPin, Heart, Globe, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import teamGrid from "@/assets/team-grid-new.jpg";
import fulltimeIcon from "@/assets/fulltime-icon.png";

const benefits = [
  {
    icon: GraduationCap,
    title: "Weiterbildung",
    description: "Wir investieren in Ihre berufliche Entwicklung durch Kurse, Workshops und Konferenzen.",
  },
  {
    icon: DollarSign,
    title: "Attraktive Vergütung",
    description: "Wettbewerbsfähiges Gehalt mit Leistungsprämien und Mitarbeiterbeteiligung.",
  },
  {
    icon: MapPin,
    title: "Modernes Büro",
    description: "Zentrale Lage in Düsseldorf mit modernster Ausstattung und Wohlfühlatmosphäre.",
  },
  {
    icon: Heart,
    title: "Gesundheit & Wellness",
    description: "Umfassende Krankenversicherung und Wellness-Programme für Ihr Wohlbefinden.",
  },
  {
    icon: Globe,
    title: "Remote Work",
    description: "Flexible Arbeitsmodelle - arbeiten Sie dort, wo Sie am produktivsten sind.",
  },
  {
    icon: Clock,
    title: "Flexible Arbeitszeiten",
    description: "Gestalten Sie Ihre Arbeitszeit nach Ihren persönlichen Bedürfnissen.",
  },
];

const openPositions = [
  {
    category: "Engineering",
    count: 3,
    positions: [
      {
        id: "senior-backend-engineer",
        title: "Senior Software Engineer (Backend)",
        type: "Vollzeit",
        location: "Düsseldorf / Remote",
      },
      {
        id: "frontend-developer",
        title: "Frontend Developer (React/TypeScript)",
        type: "Vollzeit",
        location: "Düsseldorf",
      },
      {
        id: "devops-engineer",
        title: "DevOps Engineer",
        type: "Vollzeit",
        location: "Düsseldorf / Remote",
      },
    ],
  },
  {
    category: "Product & Design",
    count: 2,
    positions: [
      {
        id: "product-manager",
        title: "Product Manager (KYC Solutions)",
        type: "Vollzeit",
        location: "Düsseldorf",
      },
      {
        id: "ux-ui-designer",
        title: "UX/UI Designer",
        type: "Vollzeit",
        location: "Düsseldorf / Remote",
      },
    ],
  },
  {
    category: "Sales & Business",
    count: 2,
    positions: [
      {
        id: "business-development",
        title: "Business Development Manager",
        type: "Vollzeit",
        location: "Düsseldorf",
      },
      {
        id: "customer-success",
        title: "Customer Success Manager",
        type: "Vollzeit",
        location: "Düsseldorf",
      },
    ],
  },
  {
    category: "Compliance & Operations",
    count: 1,
    positions: [
      {
        id: "kyc-assistant",
        title: "Know Your Customer Assistant",
        type: "Minijob / Teilzeit / Vollzeit",
        location: "Remote",
      },
    ],
  },
];

const Careers = () => {
  return (
    <div className="min-h-screen">
      <Navigation />
      
      {/* Hero Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-6 mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight">
              Wir suchen talentierte Menschen für unser Team
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Wir sind auf der Suche nach leidenschaftlichen, selbstmotivierten und mutigen 
              Menschen, die uns beim Wachstum helfen. Wachsen Sie mit uns!
            </p>
          </div>
          
          <div className="rounded-2xl overflow-hidden shadow-[var(--shadow-medium)] border border-border">
            <img 
              src={teamGrid}
              alt="Team bei EuroScent"
              className="w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Arbeiten mit Vorteilen
            </h2>
            <p className="text-lg text-muted-foreground">
              Unser Team erhält eine wettbewerbsfähige Vergütung und hier ist ein 
              Einblick in unsere Unternehmenskultur
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="p-8 border-border hover:shadow-[var(--shadow-medium)] transition-all">
                <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 text-primary">
                  <benefit.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-3">
                  {benefit.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {benefit.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions Section */}
      <section className="relative z-10 py-20 md:py-32 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-primary tracking-wide uppercase mb-4">
              Werde Teil des Teams!
            </p>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Aktuelle Stellenangebote
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {openPositions.map((category, idx) => (
              <div key={idx} className="space-y-4">
                <h3 className="text-base font-semibold text-foreground mb-4">
                  {category.category} ({category.count})
                </h3>
                
                <div className="space-y-3">
                  {category.positions.map((position, posIdx) => (
                    <Link 
                      key={posIdx}
                      to={`/careers/${position.id}`}
                    >
                      <Card className="p-6 border-border hover:shadow-[var(--shadow-medium)] transition-all cursor-pointer group">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="text-base font-normal text-card-foreground group-hover:text-primary transition-colors mb-2">
                              {position.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground whitespace-nowrap">
                              {position.location}
                            </span>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Bereit, Teil unseres Teams zu werden?
            </h2>
            <p className="text-lg text-muted-foreground">
              Entdecken Sie unsere offenen Positionen und finden Sie Ihre perfekte Rolle 
              bei EuroScent GmbH.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button 
                variant="hero" 
                size="lg"
                onClick={() => {
                  const positionsSection = document.querySelector('section:nth-of-type(3)');
                  positionsSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Alle Stellen ansehen
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/start">
                  Über EuroScent erfahren
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Careers;
