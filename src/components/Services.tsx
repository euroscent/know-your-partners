import { Shield, Zap, Globe, Lock } from "lucide-react";

const services = [
  {
    icon: Shield,
    title: "KYC-Verifizierung in Echtzeit",
    description: "Führen Sie umfassende Know Your Customer-Prüfungen in Sekundenschnelle durch und erfüllen Sie alle regulatorischen Anforderungen.",
  },
  {
    icon: Zap,
    title: "Mehrere Anbieter-Integration",
    description: "Zugriff auf die besten KYC- und Verifizierungsanbieter weltweit, perfekt abgestimmt auf Ihre Branchenanforderungen.",
  },
  {
    icon: Globe,
    title: "Payment Provider Anbindung",
    description: "Nahtlose Integration mit führenden Zahlungsanbietern für eine reibungslose Customer Experience.",
  },
  {
    icon: Lock,
    title: "Compliance & Sicherheit",
    description: "Höchste Sicherheitsstandards und vollständige Compliance mit internationalen Regulierungen und Datenschutzgesetzen.",
  },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-32 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Optimieren Sie Ihre KYC-Prozesse
          </h2>
          <p className="text-lg text-muted-foreground">
            Stärken Sie Ihre Verifizierungsprozesse mit leistungsstarken Insights 
            und Echtzeit-Risikobewertung für Ihre Kunden weltweit.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="relative z-10 group p-6 rounded-xl border border-border bg-card hover:shadow-[var(--shadow-medium)] transition-all duration-300 hover:-translate-y-1"
            >
              <div className="mb-4 inline-flex p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <service.icon className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
