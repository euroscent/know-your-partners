import { Building2, Bitcoin, ShoppingCart, Shield, Wallet, Store, CreditCard, Plane } from "lucide-react";

const industries = [
  {
    icon: Building2,
    name: "Bankwesen",
    description: "Sichere Kundenverifizierung für Finanzinstitute",
  },
  {
    icon: Bitcoin,
    name: "Krypto",
    description: "Compliance-konforme Lösungen für Krypto-Plattformen",
  },
  {
    icon: ShoppingCart,
    name: "E-Commerce",
    description: "Betrugsschutz für Online-Händler",
  },
  {
    icon: Shield,
    name: "Versicherung",
    description: "Identitätsprüfung für Versicherungsunternehmen",
  },
  {
    icon: Wallet,
    name: "Lending",
    description: "Risikobewertung für Kreditvergabe",
  },
  {
    icon: Store,
    name: "Marktplätze",
    description: "Verkäufer- und Käuferverifizierung",
  },
  {
    icon: CreditCard,
    name: "Zahlungsanbieter",
    description: "Integration mit Payment Providern",
  },
  {
    icon: Plane,
    name: "Reisen & Gastgewerbe",
    description: "Sichere Buchungsprozesse",
  },
];

const Industries = () => {
  return (
    <section id="industries" className="relative z-10 py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Branchenlösungen
          </h2>
          <p className="text-lg text-muted-foreground">
            Maßgeschneiderte KYC-Lösungen für verschiedene Branchen mit spezifischen 
            Anforderungen und regulatorischen Standards.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {industries.map((industry, index) => (
            <div
              key={index}
              className="relative z-10 p-6 rounded-xl border border-border bg-card hover:border-primary transition-all duration-300 group"
            >
              <div className="mb-4 inline-flex p-3 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                <industry.icon className="h-6 w-6 text-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                {industry.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {industry.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Industries;
